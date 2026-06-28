import { Module } from '@nestjs/common';
import { NombaService } from './nomba.service';

@Module({
  providers: [NombaService],
  exports: [NombaService], // exported so WalletModule and WebhooksModule can use it
})
export class NombaModule {}
