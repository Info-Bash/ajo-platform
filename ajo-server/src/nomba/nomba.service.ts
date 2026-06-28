import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';

interface NombaTokenResponse {
  access_token: string;
  expires_in: number; // seconds
  token_type: string;
}

interface NombaCheckoutOrderRequest {
  orderReference: string; // our internal reference, UUID v4
  amount: string; // Nomba expects amount as string e.g. "10000.00"
  currency: 'NGN';
  callbackUrl: string;
  customerEmail: string;
  customerId: string; // our internal userId
  tokenizeCard?: boolean; // true = save card for future contributions
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

  // Cached access token — reused until it expires
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0; // Unix timestamp ms

  constructor(private readonly config: ConfigService<AppConfig>) {}

  private get nombaConfig() {
    return this.config.get('nomba', { infer: true })!;
  }

  // ─── OAuth2 Token (Client Credentials) ───────────────────────────────────

  /**
   * Returns a valid Nomba access token, fetching a new one if expired.
   * Nomba uses OAuth2 Client Credentials flow.
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (with 60s buffer)
    if (this.cachedToken && now < this.tokenExpiresAt - 60_000) {
      return this.cachedToken;
    }

    const { apiKey, secretKey, baseUrl } = this.nombaConfig;

    if (!apiKey || !secretKey) {
      throw new InternalServerErrorException(
        'Nomba API credentials not configured',
      );
    }

    const response = await fetch(`${baseUrl}/auth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: apiKey,
        client_secret: secretKey,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Nomba token fetch failed: ${response.status} ${text}`);
      throw new InternalServerErrorException(
        'Failed to authenticate with Nomba',
      );
    }

    const data = (await response.json()) as NombaTokenResponse;
    this.cachedToken = data.access_token;
    // Store expiry as Unix ms timestamp
    this.tokenExpiresAt = now + data.expires_in * 1000;

    this.logger.log('Nomba access token refreshed');
    return this.cachedToken;
  }

  // ─── Checkout Order ───────────────────────────────────────────────────────

  /**
   * Creates a Nomba checkout order and returns the checkout link.
   * The frontend redirects the user to this link to complete payment.
   * After payment, Nomba fires a payment_success webhook to our endpoint.
   *
   * @param params.amountKobo   Amount in kobo (our internal unit)
   * @param params.orderRef     Our internal reference (UUID) — stored in PendingCheckout
   * @param params.customerEmail User's email (Nomba sends receipt to this address)
   * @param params.customerId   Our internal user ID
   * @param params.callbackUrl  Where Nomba redirects after payment (frontend page)
   * @param params.tokenizeCard Whether to save the card for future charges
   */
  async createCheckoutOrder(params: {
    amountKobo: number;
    orderRef: string;
    customerEmail: string;
    customerId: string;
    callbackUrl: string;
    tokenizeCard?: boolean;
    metadata?: Record<string, string>;
  }): Promise<{ checkoutLink: string; orderReference: string }> {
    const token = await this.getAccessToken();
    const { baseUrl, accountId } = this.nombaConfig;

    // Nomba expects amount as a decimal string: 10000 kobo → "100.00"
    const amountNaira = (params.amountKobo / 100).toFixed(2);

    const body: NombaCheckoutOrderRequest = {
      orderReference: params.orderRef,
      amount: amountNaira,
      currency: 'NGN',
      callbackUrl: params.callbackUrl,
      customerEmail: params.customerEmail,
      customerId: params.customerId,
      tokenizeCard: params.tokenizeCard ?? false,
      orderMetaData: params.metadata,
    };

    const response = await fetch(`${baseUrl}/checkout/order`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'accountId': accountId,
      },
      body: JSON.stringify({ order: body }),
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
