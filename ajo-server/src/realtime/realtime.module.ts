import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfig } from '../config/app.config';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';

/**
 * @Global — imported once here in AppModule, then RealtimeService is
 * injectable anywhere (WalletModule, WebhooksModule, and future
 * GroupsModule/ContributionsModule/etc.) without re-importing this module.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    // Separate JwtModule registration from AuthModule's — the gateway only
    // ever verifies tokens, never signs them, and importing AuthModule here
    // would risk a circular dependency if AuthModule ever needs realtime.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig>) => ({
        secret: config.get('jwtSecret', { infer: true }),
      }),
    }),
  ],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
