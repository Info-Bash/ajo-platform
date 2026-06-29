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

  MAIL_HOST: Joi.string().allow('').default(''),
  MAIL_PORT: Joi.number().default(587),
  MAIL_USER: Joi.string().allow('').default(''),
  MAIL_PASS: Joi.string().allow('').default(''),
  MAIL_FROM: Joi.string().default('noreply@ajo.app'),
  GOOGLE_CLIENT_ID: Joi.string().allow('').default(''),
  FRONTEND_URL: Joi.string()
    .allow('')
    .default('https://ajo-app-eta.vercel.app'),
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
  };
  googleClientId: string;
  mail: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
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
  },
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  mail: {
    host: process.env.MAIL_HOST ?? '',
    port: parseInt(process.env.MAIL_PORT ?? '587', 10),
    user: process.env.MAIL_USER ?? '',
    pass: process.env.MAIL_PASS ?? '',
    from: process.env.MAIL_FROM ?? 'noreply@ajo.app',
  },
});
