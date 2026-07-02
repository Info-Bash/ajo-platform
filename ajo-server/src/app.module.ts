import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { NombaModule } from './nomba/nomba.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { MailModule } from './mail/mail.module';
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
    PrismaModule,
    NombaModule,
    MailModule,
    AuthModule,
    WalletModule,
    // GroupsModule,
    // ContributionsModule,
    // PayoutsModule,
    // NotificationsModule,
    // ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
