export type NombaEventType =
  | 'payment_success'
  | 'payout_success'
  | 'payment_failed'
  | 'payment_reversal'
  | 'payout_failed'
  | 'payout_refund';

export interface NombaMerchant {
  userId: string;
  walletId: string;
  walletBalance: number;
}

export interface NombaTerminal {
  terminalId: string;
  terminalLabel: string;
}

export interface NombaTransaction {
  transactionId: string;
  type: string;
  originatingFrom: string;
  rrn: string;
  transactionAmount: number;
  fee: number;
  time: string;
  terminalActionId: string;
  mcollectionsId: string;
  merchantTxRef: string;
  aliasAccountNumber: string;
  aliasAccountName: string;
  aliasAccountType: string;
  terminalSerialNumber: string;
  cardBank: string;
  cardIssuer: string;
  responseCode: string;
  responseCodeMessage?: string;
  responseMessage?: string;
  sessionId: string;
}

export interface NombaCustomer {
  billerId: string | null;
  productId: string | null;
  bankCode: string;
  cardPan: string | null;
  network: string | null;
  accountNumber: string | null;
  bankName: string | null;
  meterNumber: string | null;
  subscriberNumber: string | null;
  iucNumber: string | null;
  decoderNumber: string | null;
  senderName: string;
  recipientName: string;
}

export interface NombaWebhookData {
  merchant: NombaMerchant;
  terminal: NombaTerminal;
  transaction: NombaTransaction;
  customer: NombaCustomer;
}

export interface NombaWebhookPayload {
  event_type: NombaEventType;
  requestId: string;
  data: NombaWebhookData;
}

export interface NombaWebhookHeaders {
  'nomba-signature': string;
  'nomba-signature-algorithm': string;
  'nomba-signature-version': string;
  'nomba-timestamp': string;
}
