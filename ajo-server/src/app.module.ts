import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { NombaModule } from './nomba/nomba.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { MailModule } from './mail/mail.module';
import { RealtimeModule } from './realtime/realtime.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { GroupsModule } from './groups/groups.module';
import { ChatModule } from './chat/chat.module';
import { FriendsModule } from './friends/friends.module';
import { ContributionsModule } from './contributions/contributions.module';
import { PayoutsModule } from './payouts/payouts.module';
import { DirectMessagesModule } from './direct-messages/direct-messages.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { configFactory, validationSchema } from './config/app.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configFactory],
      validationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    NombaModule,
    MailModule,
    RealtimeModule,
    AuthModule,
    WalletModule,
    WebhooksModule,
    ChatModule,
    FriendsModule,
    GroupsModule,
    PayoutsModule,
    ContributionsModule,
    DirectMessagesModule,
    DashboardModule,
    // NotificationsModule — dedicated read/list endpoints for Notification rows
    // NotificationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
