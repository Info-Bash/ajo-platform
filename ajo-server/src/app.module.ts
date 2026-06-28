import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { NombaModule } from './nomba/nomba.module';
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
    // AuthModule,
    // WalletModule,
    // GroupsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
