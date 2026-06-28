import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  // CORS — include your deployed Vercel frontend
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://ajo-app-eta.vercel.app',
      process.env.FRONTEND_URL ?? '',
    ].filter(Boolean),
    credentials: true,
  });

  // Global validation pipe.
  // Note: forbidNonWhitelisted is false because webhook endpoints receive
  // external payloads (Nomba) that aren't decorated DTO classes.
  // Signature verification in NombaSignatureGuard handles webhook authenticity.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // can't use true with raw webhook payloads
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 Ajo API running on http://localhost:${port}/api/v1`);
}

bootstrap();
