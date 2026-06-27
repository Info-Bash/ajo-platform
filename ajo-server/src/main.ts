import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix — all routes are /api/v1/...
  app.setGlobalPrefix('api/v1');

  // CORS — allow the Next.js frontend
  app.enableCors({
    origin: [
      'http://localhost:3000',
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
    ],
    credentials: true,
  });

  // Global validation pipe — auto-validates all DTOs using class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties from request body
      forbidNonWhitelisted: true, // throw if unknown properties are sent
      transform: true, // auto-transform payloads to DTO class instances
      transformOptions: {
        enableImplicitConversion: true, // convert strings to numbers/booleans where needed
      },
    }),
  );

  // Global exception filter — consistent error shape for the frontend
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 Ajo API running on http://localhost:${port}/api/v1`);
}

bootstrap();
