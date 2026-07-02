import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { NombaModule } from '../nomba/nomba.module';

@Module({
  imports: [NombaModule],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService], // exported for use in ContributionsModule later
})
export class WalletModule {}
