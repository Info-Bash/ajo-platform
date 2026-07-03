import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';

interface NombaTokenResponse {
  code: string;
  data: {
    access_token: string;
    refresh_token: string;
    expiresAt: string; // ISO 8601 UTC, e.g. "2026-01-01T12:00:00Z" — confirmed against Nomba docs
  };
}

interface NombaCheckoutOrderRequest {
  orderReference: string; // our internal reference, UUID v4
  amount: string; // Nomba expects amount as string e.g. "10000.00"
  currency: 'NGN';
  callbackUrl: string;
  customerEmail: string;
  customerId: string; // our internal userId
  accountId?: string; // Nomba SUB-account to credit — omit to credit the parent account (our default case)
  allowedPaymentMethods?: string[];
  orderMetaData?: Record<string, string>;
}

interface NombaCheckoutOrderResponse {
  code: string; // "00" = success
  description: string;
  data: {
    checkoutLink: string;
    orderReference: string;
  };
}

@Injectable()
export class NombaService {
  private readonly logger = new Logger(NombaService.name);

  private cachedToken: string | null = null;
  private cachedRefreshToken: string | null = null;
  private tokenExpiresAt: number = 0; // Unix timestamp ms — parsed from Nomba's ISO string on receipt

  constructor(private readonly config: ConfigService<AppConfig>) {}

  private get nombaConfig() {
    return this.config.get('nomba', { infer: true })!;
  }

  async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.cachedToken && now < this.tokenExpiresAt - 5 * 60_000) {
      return this.cachedToken;
    }

    // If we already have a refresh token, prefer refreshing over re-issuing
    if (this.cachedRefreshToken) {
      try {
        return await this.refreshAccessToken();
      } catch (err) {
        this.logger.warn('Refresh failed, falling back to full re-auth', err);
      }
    }

    const { apiKey, secretKey, baseUrl, accountId } = this.nombaConfig;

    if (!apiKey || !secretKey) {
      throw new InternalServerErrorException(
        'Nomba API credentials not configured',
      );
    }

    const response = await fetch(`${baseUrl}/auth/token/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accountId,
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: apiKey,
        client_secret: secretKey,
      }),
    });

    const payload = (await response.json()) as NombaTokenResponse;

    if (!response.ok || payload.code !== '00') {
      this.logger.error(
        `Nomba token fetch failed: ${response.status} ${JSON.stringify(payload)}`,
      );
      throw new InternalServerErrorException(
        'Failed to authenticate with Nomba',
      );
    }

    const { access_token, refresh_token, expiresAt } = payload.data;
    this.cachedToken = access_token;
    this.cachedRefreshToken = refresh_token;
    // expiresAt is an ISO 8601 string (e.g. "2026-01-01T12:00:00Z") — parse to epoch ms
    this.tokenExpiresAt = new Date(expiresAt).getTime();

    this.logger.log('Nomba access token issued');
    return this.cachedToken;
  }

  async refreshAccessToken(): Promise<string> {
    if (!this.cachedToken || !this.cachedRefreshToken) {
      throw new InternalServerErrorException('No refresh token available');
    }

    const { baseUrl, accountId } = this.nombaConfig;

    const response = await fetch(`${baseUrl}/auth/token/refresh`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cachedToken}`,
        'Content-Type': 'application/json',
        accountId,
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: this.cachedRefreshToken,
      }),
    });

    const payload = (await response.json()) as NombaTokenResponse;

    if (!response.ok || payload.code !== '00') {
      this.logger.error(
        `Nomba token refresh failed: ${response.status} ${JSON.stringify(payload)}`,
      );
      throw new InternalServerErrorException('Failed to refresh Nomba token');
    }

    const { access_token, refresh_token, expiresAt } = payload.data;
    this.cachedToken = access_token;
    this.cachedRefreshToken = refresh_token ?? this.cachedRefreshToken;
    this.tokenExpiresAt = new Date(expiresAt).getTime();

    this.logger.log('Nomba access token refreshed');
    return this.cachedToken;
  }

  async revokeAccessToken(): Promise<void> {
    if (!this.cachedToken) return;

    const { baseUrl, accountId, apiKey } = this.nombaConfig;

    const response = await fetch(`${baseUrl}/auth/token/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accountId,
      },
      body: JSON.stringify({
        clientId: apiKey,
        access_token: this.cachedToken,
      }),
    });

    const payload = await response.json();

    if (!response.ok || payload.code !== '00') {
      this.logger.error(
        `Nomba token revoke failed: ${response.status} ${JSON.stringify(payload)}`,
      );
      throw new InternalServerErrorException('Failed to revoke Nomba token');
    }

    this.cachedToken = null;
    this.cachedRefreshToken = null;
    this.tokenExpiresAt = 0;
    this.logger.log('Nomba access token revoked');
  }

  // ─── Checkout Order ───────────────────────────────────────────────────────

  /**
   * Creates a Nomba checkout order and returns the checkout link.
   * The frontend redirects the user to this link to complete payment.
   * After payment, Nomba fires a payment_success webhook to our endpoint.
   *
   * @param params.amountKobo   Amount in kobo (our internal unit)
   * @param params.currency     Currency code (e.g., 'NGN')
   * @param params.orderRef     Our internal reference (UUID) — stored in PendingCheckout
   * @param params.customerEmail User's email (Nomba sends receipt to this address)
   * @param params.allowedPaymentMethods e.g. ['Card', 'Transfer'] — omit to show all available methods
   * @param params.customerId   Our internal user ID
   * @param params.accountId    Nomba SUB-account to credit — only pass this if you actually
   *                            want funds routed to a sub-account instead of the parent account.
   *                            Omit for normal wallet funding.
   * @param params.callbackUrl  Where Nomba redirects after payment (frontend page)
   * @param params.tokenizeCard Whether to save the card for future charges
   */
  async createCheckoutOrder(params: {
    amountKobo: number;
    currency?: 'NGN';
    orderRef: string;
    customerEmail: string;
    allowedPaymentMethods?: string[];
    customerId: string;
    accountId?: string;
    callbackUrl: string;
    tokenizeCard?: boolean;
    metadata?: Record<string, string>;
  }): Promise<{ checkoutLink: string; orderReference: string }> {
    const token = await this.getAccessToken();
    const { baseUrl, accountId } = this.nombaConfig;

    // Nomba expects amount as a decimal string: 10000 kobo → "100.00"
    const amountNaira = (params.amountKobo / 100).toFixed(2);

    const order: NombaCheckoutOrderRequest = {
      orderReference: params.orderRef,
      amount: amountNaira,
      currency: params.currency ?? 'NGN',
      callbackUrl: params.callbackUrl,
      customerEmail: params.customerEmail,
      customerId: params.customerId,
      allowedPaymentMethods: params.allowedPaymentMethods,
      orderMetaData: params.metadata,
      // Only set when the caller explicitly wants sub-account routing —
      // omitted entirely otherwise, so Nomba defaults to crediting the parent account.
      ...(params.accountId ? { accountId: params.accountId } : {}),
    };

    const response = await fetch(`${baseUrl}/checkout/order`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'accountId': accountId,
      },
      body: JSON.stringify({
        order,
        // tokenizeCard is top-level, a sibling of `order` — NOT nested inside
        // it. Confirmed against Nomba's own "Top-level fields" table (order,
        // tokenizeCard, meta are siblings); their inline JS example
        // contradicts this, but the table + generated request schema agree
        // with each other and match every real request example in the docs.
        tokenizeCard: params.tokenizeCard ?? false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `Nomba checkout order creation failed: ${response.status} ${text}`,
      );
      throw new InternalServerErrorException(
        'Failed to create payment checkout. Please try again.',
      );
    }

    const data = (await response.json()) as NombaCheckoutOrderResponse;

    if (data.code !== '00') {
      this.logger.error(
        `Nomba checkout returned non-success code: ${data.code} ${data.description}`,
      );
      throw new InternalServerErrorException(
        'Payment provider returned an error. Please try again.',
      );
    }

    return {
      checkoutLink: data.data.checkoutLink,
      orderReference: data.data.orderReference,
    };
  }
}
