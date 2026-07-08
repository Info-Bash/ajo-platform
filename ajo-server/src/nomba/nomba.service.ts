import {
  Injectable,
  Logger,
  InternalServerErrorException,
  BadRequestException,
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

// ─── Payout (Bank Transfer) types ──────────────────────────────────────────

interface NombaBank {
  code: string; // Use this as bankCode in lookup/transfer requests
  name: string;
}

interface NombaBankListResponse {
  code: string;
  description: string;
  data: NombaBank[];
}

interface NombaBankLookupResponse {
  code: string;
  description: string;
  data: { accountNumber: string; accountName: string };
}

interface NombaBankPayoutResponse {
  code: string; // "00"/"200" on a normal response, "201" means "still processing"
  description: string;
  status?: boolean; // true = call succeeded; NOTE data.status is the real transfer status
  data: {
    // Nomba's transfer ID. NOTE: this can be ABSENT on a "201 processing"
    // response — do not assume it's always present, see createBankPayout().
    id?: string;
    status: 'SUCCESS' | 'PENDING_BILLING' | 'NEW' | 'REFUND' | string;
  };
}

@Injectable()
export class NombaService {
  private readonly logger = new Logger(NombaService.name);

  private cachedToken: string | null = null;
  private cachedRefreshToken: string | null = null;
  private tokenExpiresAt: number = 0; // Unix timestamp ms — parsed from Nomba's ISO string on receipt

  // Bank list rarely changes — Nomba's own docs say to cache it. In-memory
  // cache is fine here (worst case a Render restart just means one extra
  // fetch); TTL is generous since bank codes are effectively static.
  private cachedBanks: NombaBank[] | null = null;
  private banksCachedAt = 0;
  private static readonly BANKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

  constructor(private readonly config: ConfigService<AppConfig>) {}

  private get nombaConfig() {
    return this.config.get('nomba', { infer: true })!;
  }

  // Payout endpoints (bank list, account lookup, bank transfer) live on
  // /v1 and /v2 depending on the endpoint, which doesn't match the checkout
  // API's fixed /v1 base. Derive the bare origin so each method can pin its
  // own version explicitly instead of silently trusting NOMBA_BASE_URL's
  // version segment.
  private get apiOrigin(): string {
    return this.nombaConfig.baseUrl.replace(/\/v\d+\/?$/, '');
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

  // ─── Payout (Bank Transfer) ────────────────────────────────────────────────

  /**
   * Fetches the list of Nomba-supported banks (code + name), used to
   * populate the "select bank" step in the withdrawal flow and to resolve
   * a bankCode's display name for saved beneficiaries. Cached in-memory for
   * 24h per Nomba's own guidance ("call this endpoint once and cache the
   * result — bank codes rarely change").
   */
  async getBankList(): Promise<{ code: string; name: string }[]> {
    const now = Date.now();
    if (this.cachedBanks && now < this.banksCachedAt + NombaService.BANKS_CACHE_TTL_MS) {
      return this.cachedBanks;
    }

    const token = await this.getAccessToken();
    const { accountId } = this.nombaConfig;

    const response = await fetch(`${this.apiOrigin}/v1/transfers/banks`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        accountId,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Nomba bank list fetch failed: ${response.status} ${text}`);
      throw new InternalServerErrorException('Failed to fetch bank list. Please try again.');
    }

    const payload = (await response.json()) as NombaBankListResponse;

    if (payload.code !== '00') {
      this.logger.error(`Nomba bank list returned non-success code: ${payload.code}`);
      throw new InternalServerErrorException('Failed to fetch bank list. Please try again.');
    }

    this.cachedBanks = payload.data;
    this.banksCachedAt = now;
    return this.cachedBanks;
  }

  /**
   * Verifies a destination account before initiating a payout — resolves
   * the bank's real account name for a given accountNumber + bankCode.
   * Always call this immediately before a transfer (even for a previously
   * saved beneficiary) since accounts can be closed or renamed.
   */
  async resolveBankAccount(params: {
    accountNumber: string;
    bankCode: string;
  }): Promise<{ accountNumber: string; accountName: string }> {
    const token = await this.getAccessToken();
    const { accountId } = this.nombaConfig;

    const response = await fetch(`${this.apiOrigin}/v1/transfers/bank/lookup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        accountId,
      },
      body: JSON.stringify({
        accountNumber: params.accountNumber,
        bankCode: params.bankCode,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Nomba account lookup failed: ${response.status} ${text}`);
      throw new BadRequestException(
        'Could not verify that account number. Please check the details and try again.',
      );
    }

    const payload = (await response.json()) as NombaBankLookupResponse;

    if (payload.code !== '00') {
      throw new BadRequestException(
        'Could not verify that account number. Please check the details and try again.',
      );
    }

    return payload.data;
  }

  /**
   * Initiates a bank payout (withdrawal) from our Nomba sub-account.
   *
   * IMPORTANT — unlike checkout's `amount` (a decimal STRING like "100.00"),
   * the transfer-to-banks endpoint takes `amount` as a plain NUMBER in
   * Naira (confirmed against Nomba's docs — their own example request uses
   * `"amount": 3500` for a ₦3,500 transfer). Mixing these two conventions
   * up is an easy way to send 100x the intended amount — do not "fix" this
   * to match createCheckoutOrder's string format.
   *
   * merchantTxRef is OUR idempotency key. Per Nomba's own guidance:
   *   - it must be unique per transaction and reused only on retry of the
   *     SAME transaction (never reused after a transfer has been accepted)
   *   - the payout webhook echoes it back at data.transaction.merchantTxRef,
   *     so the caller should treat merchantTxRef — not this method's
   *     returned `id` — as the source of truth for matching the webhook.
   *     `id` can be genuinely absent on a "processing" response, whereas
   *     merchantTxRef is always known because we generated it ourselves.
   *     (See the checkout orderReference incident for why we don't trust a
   *     provider-echoed value as the primary key when we already hold the
   *     original ourselves.)
   *
   * A non-throwing "ambiguous" outcome (network error / non-2xx / unexpected
   * shape) is intentionally surfaced as a thrown error rather than assumed
   * to be a failure — per Nomba's guidance, an unclear response should be
   * treated as PENDING and resolved via the webhook or a requery, NOT
   * retried with a new reference and NOT assumed to have definitely failed.
   */
  async createBankPayout(params: {
    amountKobo: number;
    accountNumber: string;
    accountName: string;
    bankCode: string;
    merchantTxRef: string;
    senderName?: string;
    narration?: string;
  }): Promise<{ nombaTransferId: string | null; status: string }> {
    const token = await this.getAccessToken();
    const { accountId, subAccountId } = this.nombaConfig;

    const amountNaira = params.amountKobo / 100;

    // Transfer from the configured sub-account when one is set (this app
    // funds via a sub-account too — see NOMBA_SUB_ACCOUNT_ID). Sub-account
    // transfers must be explicitly enabled on your Nomba account first;
    // if you see a "feature not enabled" error here, contact Nomba support.
    const path = subAccountId
      ? `/v2/transfers/bank/${subAccountId}`
      : '/v2/transfers/bank';

    let response: Response;
    try {
      response = await fetch(`${this.apiOrigin}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          accountId,
        },
        body: JSON.stringify({
          amount: amountNaira,
          accountNumber: params.accountNumber,
          accountName: params.accountName,
          bankCode: params.bankCode,
          merchantTxRef: params.merchantTxRef,
          senderName: params.senderName,
          narration: params.narration,
        }),
      });
    } catch (err) {
      this.logger.error(`Nomba payout request threw before a response was received: ${err}`);
      // Genuinely ambiguous — we don't know if Nomba received this or not.
      // Do NOT tell the caller this failed (that could lead to a refund
      // plus a duplicate manual retry on top of a transfer that actually
      // went through). Let it sit PENDING; the webhook or a requery will
      // resolve it.
      throw new InternalServerErrorException(
        'Withdrawal is being processed. If it does not confirm shortly, contact support before retrying.',
      );
    }

    const payload = (await response.json().catch(() => null)) as NombaBankPayoutResponse | null;

    if (!response.ok || !payload) {
      this.logger.error(
        `Nomba payout returned an unclear response: httpStatus=${response.status} body=${JSON.stringify(payload)}`,
      );
      throw new InternalServerErrorException(
        'Withdrawal is being processed. If it does not confirm shortly, contact support before retrying.',
      );
    }

    // code "201" = accepted but not yet resolved ("PROCESSING"); `data.id`
    // may not be populated yet in this case.
    this.logger.log(
      `Nomba payout initiated: merchantTxRef=${params.merchantTxRef} code=${payload.code} status=${payload.data?.status}`,
    );

    return {
      nombaTransferId: payload.data?.id ?? null,
      status: payload.data?.status ?? 'UNKNOWN',
    };
  }
}
