import { Module } from '@nestjs/common';
import { ContributionsService } from './contributions.service';
import { ContributionsController } from './contributions.controller';
import { ContributionsCronService } from './contributions-cron.service';
import { PayoutsModule } from '../payouts/payouts.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [PayoutsModule, ChatModule],
  controllers: [ContributionsController],
  providers: [ContributionsService, ContributionsCronService],
  exports: [ContributionsService],
})
export class ContributionsModule {}
