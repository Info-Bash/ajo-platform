import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppConfig } from '../config/app.config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService<AppConfig>) {
    const mail = this.config.get('mail', { infer: true })!;

    this.transporter = nodemailer.createTransport({
      host: mail.host,
      port: mail.port,
      secure: false, // Brevo uses STARTTLS on port 587
      // Force IPv4. Render and many container hosts don't have outbound
      // IPv6 — without this, Node may resolve smtp-relay.brevo.com to ::1
      // / an AAAA record and fail with ECONNREFUSED ::1:587.
      family: 4,
      auth: {
        user: mail.user,
        pass: mail.pass,
      },
    });
  }

  // ─── OTP Verification Email ──────────────────────────────────────────────

  async sendOtp(to: string, otp: string, fullName?: string): Promise<void> {
    const mail = this.config.get('mail', { infer: true })!;
    const name = fullName ?? 'there';

    await this.transporter.sendMail({
      from: `"Ajo App" <${mail.from}>`,
      to,
      subject: `Your Ajo verification code: ${otp}`,
      text: `Hi ${name},\n\nYour Ajo email verification code is:\n\n${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't create an Ajo account, ignore this email.\n\nThe Ajo Team`,
      html: `
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

    this.logger.log(`OTP email sent to ${to}`);
  }

  // ─── Password Reset Email ────────────────────────────────────────────────

  async sendPasswordReset(
    to: string,
    token: string,
    fullName?: string,
  ): Promise<void> {
    const mail = this.config.get('mail', { infer: true })!;
    const name = fullName ?? 'there';

    // The frontend reset page reads ?email=...&token=... from the URL
    const frontendUrl =
      process.env.FRONTEND_URL ?? 'https://ajo-app-eta.vercel.app';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}&email=${encodeURIComponent(to)}`;

    await this.transporter.sendMail({
      from: `"Ajo App" <${mail.from}>`,
      to,
      subject: 'Reset your Ajo password',
      text: `Hi ${name},\n\nClick the link below to reset your password. This link expires in 1 hour.\n\n${resetUrl}\n\nIf you didn't request a password reset, ignore this email.\n\nThe Ajo Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0F766E; margin-bottom: 8px;">Reset your password</h2>
          <p style="color: #475569; margin-bottom: 24px;">Hi ${name}, we received a request to reset your Ajo password.</p>

          <a href="${resetUrl}"
             style="display: inline-block; background: #0F766E; color: white; padding: 12px 24px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; margin-bottom: 24px;">
            Reset password
          </a>

          <p style="color: #64748B; font-size: 14px;">This link expires in <strong>1 hour</strong>.</p>
          <p style="color: #64748B; font-size: 14px;">If you didn't request a password reset, ignore this email — your password won't change.</p>
          <p style="color: #94A3B8; font-size: 12px; word-break: break-all;">Or copy this link: ${resetUrl}</p>

          <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
          <p style="color: #94A3B8; font-size: 12px;">The Ajo Team · Save together, withdraw with confidence.</p>
        </div>
      `,
    });

    this.logger.log(`Password reset email sent to ${to}`);
  }

  // ─── Generic notification email (used later for payout/contribution alerts) ──

  async sendNotification(
    to: string,
    subject: string,
    body: string,
  ): Promise<void> {
    const mail = this.config.get('mail', { infer: true })!;

    await this.transporter.sendMail({
      from: `"Ajo App" <${mail.from}>`,
      to,
      subject,
      text: body,
    });

    this.logger.log(`Notification email sent to ${to}: ${subject}`);
  }
}
