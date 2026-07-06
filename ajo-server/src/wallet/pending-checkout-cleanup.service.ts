import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

// Grace period added on top of a checkout's own `expiresAt` before we mark
// it EXPIRED. Nomba's webhook can legitimately arrive a little after the
// checkout link's stated expiry (user finished paying right at the wire,
// webhook delivery lag, retry backoff, etc.), so we don't want the cron
// racing a still-valid webhook.
const EXPIRY_GRACE_PERIOD_MS = 15 * 60 * 1000;

@Injectable()
export class PendingCheckoutCleanupService {
  private readonly logger = new Logger(PendingCheckoutCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupExpiredCheckouts(): Promise<void> {
    const cutoff = new Date(Date.now() - EXPIRY_GRACE_PERIOD_MS);

    // Soft-delete only: mark EXPIRED rather than deleting the row outright.
    // We deliberately keep expired rows around (rather than hard-deleting)
    // so that if a payment_success webhook ever does arrive very late — or
    // a bug like the orderReference mismatch we hit before resurfaces — the
    // record still exists and the payment can be reconciled manually instead
    // of vanishing without a trace.
    const result = await this.prisma.pendingCheckout.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: cutoff },
      },
      data: { status: 'EXPIRED' },
    });

    if (result.count > 0) {
      this.logger.log(`Marked ${result.count} stale PendingCheckout row(s) as EXPIRED`);
    }
  }
}