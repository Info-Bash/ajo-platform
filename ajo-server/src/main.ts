import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://ajo-app-eta.vercel.app',
      process.env.FRONTEND_URL ?? '',
    ].filter(Boolean),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  // ── Swagger ──────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Ajo API')
    .setDescription(
      `REST API for the Ajo rotating savings circle (ajo) platform.\n\n` +
      `**Authentication:** Most endpoints require a Bearer JWT. Obtain a token via  ` + `\`POST /auth/login\`, \`POST /auth/verify-email\`, or \`POST /auth/google\`, ` + `then click **Authorize** and enter: \`Bearer <your_token>\`.`,
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .addServer('https://ajo-server.onrender.com', 'Production')
    .addServer('http://localhost:3001', 'Local development')
    .addTag(
      'Auth',
      'Registration, login, email verification, password reset, Google OAuth',
    )
    .addTag(
      'Wallet',
      'Balance, funding via Nomba checkout, internal transfers, transaction history',
    )
    .addTag('Webhooks', 'Inbound Nomba payment event callbacks')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Available at /api/v1/docs
  SwaggerModule.setup('api/v1/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // keeps the JWT filled in across page refreshes
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Ajo API Docs',
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`🚀 Ajo API running on http://localhost:${port}/api/v1`);
  console.log(`📖 Swagger docs  at http://localhost:${port}/api/v1/docs`);
}

bootstrap();
