import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';
import { NombaWebhookPayload } from './nomba-webhook.types';

@Injectable()
export class NombaSignatureGuard implements CanActivate {
  private readonly logger = new Logger(NombaSignatureGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const signatureKey = this.config.get<string>('nomba.webhookSignatureKey');

    if (!signatureKey) {
      this.logger.warn(
        'NOMBA_WEBHOOK_SIGNATURE_KEY not set — skipping verification (dev only)',
      );
      return true;
    }

    const receivedSignature = req.headers['nomba-signature'] as string;
    const timestamp = req.headers['nomba-timestamp'] as string;

    if (!receivedSignature || !timestamp) {
      this.logger.warn('Missing nomba-signature or nomba-timestamp header');
      throw new UnauthorizedException('Missing Nomba signature headers');
    }

    const payload = req.body as NombaWebhookPayload;

    if (!payload?.event_type || !payload?.requestId || !payload?.data) {
      throw new UnauthorizedException(
        'Invalid Nomba webhook payload structure',
      );
    }

    const { event_type, requestId, data } = payload;
    const { merchant, transaction } = data;

    // Nomba's exact signing string — matches their official docs:
    // event_type:requestId:userId:walletId:transactionId:type:time:responseCode:timestamp
    // Note: responseCode "null" (string) must be treated as empty string
    let responseCode = transaction?.responseCode ?? '';
    if (responseCode === 'null') responseCode = '';

    const signingString = [
      event_type,
      requestId,
      merchant?.userId ?? '',
      merchant?.walletId ?? '',
      transaction?.transactionId ?? '',
      transaction?.type ?? '',
      transaction?.time ?? '',
      responseCode,
      timestamp,
    ].join(':');

    // Nomba signs with HMAC-SHA256 and encodes as BASE64 (not hex)
    const computed = crypto
      .createHmac('sha256', signatureKey)
      .update(signingString)
      .digest('base64');

    // Case-insensitive comparison using timingSafeEqual to prevent timing attacks
    let isValid = false;
    try {
      const computedBuf = Buffer.from(computed);
      const receivedBuf = Buffer.from(receivedSignature);
      // Buffers must be same length for timingSafeEqual
      if (computedBuf.length === receivedBuf.length) {
        isValid = crypto.timingSafeEqual(computedBuf, receivedBuf);
      } else {
        // Length mismatch — definitely invalid, but still do a dummy compare
        // to avoid leaking timing info about which check failed
        crypto.timingSafeEqual(computedBuf, computedBuf);
        isValid = false;
      }
    } catch {
      isValid = false;
    }

    if (!isValid) {
      this.logger.warn(
        `Nomba signature mismatch requestId=${requestId} ` +
          `computed=${computed} received=${receivedSignature}`,
      );
      throw new UnauthorizedException('Invalid Nomba webhook signature');
    }

    return true;
  }
}
