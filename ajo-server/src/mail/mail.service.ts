/**
 * MailService — sends transactional email via Brevo's HTTP API
 * (POST https://api.brevo.com/v3/smtp/email), NOT SMTP.
 *
 * Why HTTP API instead of SMTP:
 * Render's free tier blocks all outbound traffic to SMTP ports 25, 465,
 * and 587. The HTTP API runs over standard HTTPS (port 443), which is
 * never blocked, so this works on Render's free plan with zero hosting
 * cost increase.
 *
 * Auth: Brevo API key in the `api-key` header (NOT an SMTP key — this
 * is the key that starts with `xsmtpsib-...`, found in Brevo dashboard
 * under Settings → SMTP & API → API Keys tab).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

interface BrevoEmailPayload {
  sender: { name: string; email: string };
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

interface BrevoSuccessResponse {
  messageId: string;
}

interface BrevoErrorResponse {
  code: string;
  message: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService<AppConfig>) {
    const mail = this.config.get('mail', { infer: true })!;
    if (!mail.apiKey) {
      this.logger.warn(
        'BREVO_API_KEY is not set — emails will fail to send until configured.',
      );
    }
  }

  private async send(payload: BrevoEmailPayload): Promise<void> {
    const mail = this.config.get('mail', { infer: true })!;

    if (!mail.apiKey) {
      this.logger.error(
        `Cannot send email to ${payload.to[0]?.email} — BREVO_API_KEY not configured`,
      );
      return; // Don't throw — registration/login should not fail because email is misconfigured
    }

    let response: Response;
    try {
      response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'api-key': mail.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Network-level failure (DNS, timeout, etc.) — log but don't crash the request
      this.logger.error(
        `Brevo API request failed for ${payload.to[0]?.email}: ${(err as Error).message}`,
      );
      return;
    }

    if (!response.ok) {
      const errorBody = (await response
        .json()
        .catch(() => null)) as BrevoErrorResponse | null;
      this.logger.error(
        `Brevo API returned ${response.status} for ${payload.to[0]?.email}: ` +
          `${errorBody?.code ?? 'unknown'} — ${errorBody?.message ?? 'no message'}`,
      );
      return;
    }

    const data = (await response.json()) as BrevoSuccessResponse;
    this.logger.log(
      `Email sent to ${payload.to[0]?.email} — messageId: ${data.messageId}`,
    );
  }

  private getSender() {
    const mail = this.config.get('mail', { infer: true })!;
    return { name: mail.fromName, email: mail.from };
  }

  // ─── OTP Verification Email ──────────────────────────────────────────────

  async sendOtp(to: string, otp: string, fullName?: string): Promise<void> {
    const name = fullName ?? 'there';

    await this.send({
      sender: this.getSender(),
      to: [{ email: to, name: fullName }],
      subject: `Your Ajo verification code: ${otp}`,
      textContent: `Hi ${name},\n\nYour Ajo email verification code is:\n\n${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't create an Ajo account, ignore this email.\n\nThe Ajo Team`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0F766E; margin-bottom: 8px;">Verify your email</h2>
          <p style="color: #475569; margin-bottom: 24px;">Hi ${name}, enter this code to verify your Ajo account:</p>
          <div style="background: #F1F5F9; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0F172A; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #64748B; font-size: 14px;">This code expires in <strong>10 minutes</strong>.</p>
          <p style="color: #64748B; font-size: 14px;">If you didn't create an Ajo account, you can safely ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
          <p style="color: #94A3B8; font-size: 12px;">The Ajo Team · Save together, withdraw with confidence.</p>
        </div>
      `,
    });
  }

  // ─── Password Reset Email ────────────────────────────────────────────────

  async sendPasswordReset(
    to: string,
    token: string,
    fullName?: string,
  ): Promise<void> {
    const name = fullName ?? 'there';
    const frontendUrl =
      process.env.FRONTEND_URL ?? 'https://ajo-app-eta.vercel.app';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(to)}`;

    await this.send({
      sender: this.getSender(),
      to: [{ email: to, name: fullName }],
      subject: 'Reset your Ajo password',
      textContent: `Hi ${name},\n\nClick the link below to reset your password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request a password reset, ignore this email.\n\nThe Ajo Team`,
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0F766E; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #475569; margin-bottom: 24px;">Hi ${name}, we received a request to reset your Ajo password.</p>
          <a href="${resetUrl}"
             style="display: inline-block; background: #0F766E; color: white; padding: 12px 24px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">
            Reset password
          </a>
          <p style="color: #64748B; font-size: 14px;">This link expires in <strong>1 hour</strong>.</p>
          <p style="color: #64748B; font-size: 14px;">If you didn't request this, ignore this email — your password won't change.</p>
          <p style="color: #94A3B8; font-size: 12px; word-break: break-all;">Or copy this link: ${resetUrl}</p>
          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
          <p style="color: #94A3B8; font-size: 12px;">The Ajo Team · Save together, withdraw with confidence.</p>
        </div>
      `,
    });
  }

  // ─── Generic notification email ──────────────────────────────────────────

  async sendNotification(to: string, subject: string, body: string): Promise<void> {
    await this.send({
      sender: this.getSender(),
      to: [{ email: to }],
      subject,
      textContent: body,
      htmlContent: `<p>${body.replace(/\n/g, '<br/>')}</p>`,
    });
  }
}