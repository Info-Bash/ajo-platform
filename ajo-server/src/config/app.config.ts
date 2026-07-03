import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),

  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().required(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),

  NOMBA_API_KEY: Joi.string().allow('').default(''),
  NOMBA_SECRET_KEY: Joi.string().allow('').default(''),
  NOMBA_BASE_URL: Joi.string().default('https://api.nomba.com/v1'),
  NOMBA_ACCOUNT_ID: Joi.string().allow('').default(''),
  NOMBA_SUB_ACCOUNT_ID: Joi.string().allow('').default(''),
  NOMBA_WEBHOOK_SIGNATURE_KEY: Joi.string().allow('').default(''),

  MAIL_HOST: Joi.string().allow('').default(''),
  MAIL_PORT: Joi.number().default(587),
  MAIL_USER: Joi.string().allow('').default(''),
  MAIL_PASS: Joi.string().allow('').default(''),
  MAIL_FROM: Joi.string().default('abubakarbabatunde20@gmail.com'),
  MAIL_FROM_NAME: Joi.string().default('Ajo App'),
  BREVO_API_KEY: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').default(''),
  FRONTEND_URL: Joi.string()
    .allow('')
    .default('https://ajo-app-eta.vercel.app'),
  BACKEND_URL: Joi.string()
    .allow('')
    .default('https://ajo-server.onrender.com'),
});

export interface AppConfig {
  nodeEnv: string;
  port: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  nomba: {
    apiKey: string;
    secretKey: string;
    baseUrl: string;
    accountId: string;
    subAccountId: string;
    webhookSignatureKey: string;
  };
  googleClientId: string;
  googleClientSecret: string;
  frontendUrl: string;
  backendUrl: string;
  mail: {
    apiKey: string;
    from: string;
    fromName: string;
  };
}

export const configFactory = (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3001', 10),
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  nomba: {
    apiKey: process.env.NOMBA_API_KEY ?? '',
    secretKey: process.env.NOMBA_SECRET_KEY ?? '',
    baseUrl: process.env.NOMBA_BASE_URL ?? 'https://api.nomba.com/v1',
    accountId: process.env.NOMBA_ACCOUNT_ID ?? '',
    subAccountId: process.env.NOMBA_SUB_ACCOUNT_ID ?? '',
    webhookSignatureKey: process.env.NOMBA_WEBHOOK_SIGNATURE_KEY ?? '',
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  frontendUrl: process.env.FRONTEND_URL ?? 'https://ajo-app-eta.vercel.app',
  backendUrl: process.env.BACKEND_URL ?? 'https://ajo-server.onrender.com',
  mail: {
    apiKey: process.env.BREVO_API_KEY ?? '',
    from: process.env.MAIL_FROM ?? 'abubakarbabatunde20@gmail.com',
    fromName: process.env.MAIL_FROM_NAME ?? 'Ajo App',
  },
});
