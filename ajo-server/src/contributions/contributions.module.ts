import { Module } from '@nestjs/common';
import { ContributionsService } from './contributions.service';
import { ContributionsController } from './contributions.controller';
import { ContributionsCronService } from './contributions-cron.service';
import { PayoutsModule } from '../payouts/payouts.module';

@Module({
  imports: [PayoutsModule],
  controllers: [ContributionsController],
  providers: [ContributionsService, ContributionsCronService],
  exports: [ContributionsService],
})
export class ContributionsModule {}
