import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ContributionsService } from './contributions.service';

/**
 * Runs every minute — fine-grained enough to feel responsive for TESTING-
 * frequency groups (3-minute rounds) without hammering the DB for real
 * DAILY/WEEKLY/MONTHLY groups. Mirrors the pattern in
 * wallet/pending-checkout-cleanup.service.ts.
 */
@Injectable()
export class ContributionsCronService {
  private readonly logger = new Logger(ContributionsCronService.name);
  private isRunning = false;

  constructor(private readonly contributionsService: ContributionsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTick(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Previous tick still running, skipping this one');
      return;
    }
    this.isRunning = true;
    try {
      await this.contributionsService.processActiveRounds();
    } catch (err) {
      this.logger.error(`Contribution tick failed: ${err}`);
    } finally {
      this.isRunning = false;
    }
  }
}
