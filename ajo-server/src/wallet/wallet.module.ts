import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { PendingCheckoutCleanupService } from './pending-checkout-cleanup.service';
import { NombaModule } from '../nomba/nomba.module';

@Module({
  imports: [NombaModule],
  controllers: [WalletController],
  providers: [WalletService, PendingCheckoutCleanupService],
  exports: [WalletService], // exported for use in ContributionsModule later
})
export class WalletModule {}
