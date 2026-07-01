import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  Patch,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/app.config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  GoogleAuthDto,
  CompleteProfileDto,
} from './dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  /**
   * POST /api/v1/auth/register
   * Creates user account + wallet, sends email OTP.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /api/v1/auth/verify-email
   * Confirms the 6-digit OTP. Returns JWT on success.
   */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyEmail(dto);
  }

  /**
   * POST /api/v1/auth/resend-otp
   * Sends a fresh OTP to the user's email.
   */
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  /**
   * POST /api/v1/auth/login
   * Email + password login. Returns JWT.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /api/v1/auth/google
   * Google OAuth — verifies idToken from frontend Google SDK (One Tap / popup flow).
   * Returns JWT. Creates account if first time.
   * Kept for backward compatibility — prefer the redirect flow below for new clients.
   */
  @Post('google')
  @HttpCode(HttpStatus.OK)
  googleAuth(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto.idToken);
  }

  /**
   * GET /api/v1/auth/google
   * Redirect OAuth flow, step 1: sends the browser to Google's consent screen.
   * Frontend just does `window.location.href = "${API_URL}/auth/google"`.
   */
  @Get('google')
  googleRedirect(@Res() res: Response) {
    const backendUrl = this.config.get('backendUrl', { infer: true });
    const redirectUri = `${backendUrl}/api/v1/auth/google/callback`;
    const url = this.authService.buildGoogleAuthUrl(redirectUri);
    return res.redirect(url);
  }

  /**
   * GET /api/v1/auth/google/callback
   * Redirect OAuth flow, step 2: Google redirects here with ?code=...
   * We exchange the code for tokens, upsert the user, then redirect the
   * browser back to the frontend with our JWT as a query param so the
   * frontend's auth-callback page can pick it up and store it.
   */
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get('frontendUrl', { infer: true });

    if (error || !code) {
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(
          error ?? 'Google sign-in was cancelled',
        )}`,
      );
    }

    try {
      const backendUrl = this.config.get('backendUrl', { infer: true });
      const redirectUri = `${backendUrl}/api/v1/auth/google/callback`;

      const result = await this.authService.googleAuthRedirect(
        code,
        redirectUri,
      );

      const params = new URLSearchParams({
        token: result.accessToken,
        isNewUser: String(result.isNewUser),
      });

      // Frontend has a dedicated page that reads ?token= and stores it,
      // then routes to /complete-profile or /dashboard as appropriate.
      return res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    } catch (err) {
      const message =
        err instanceof BadRequestException
          ? err.message
          : 'Google sign-in failed. Please try again.';
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(message)}`,
      );
    }
  }

  /**
   * POST /api/v1/auth/forgot-password
   * Sends password reset token to email.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * POST /api/v1/auth/reset-password
   * Consumes reset token and sets new password.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * GET /api/v1/auth/me
   * Returns the authenticated user's profile + wallet balance.
   * Requires: Bearer JWT
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: { id: string }) {
    return this.authService.getMe(user.id);
  }

  /**
   * PATCH /api/v1/auth/complete-profile
   * Google OAuth users complete their profile by adding phone number.
   * Requires: Bearer JWT
   */
  @Patch('complete-profile')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  completeProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: CompleteProfileDto,
  ) {
    return this.authService.completeProfile(user.id, dto.phone);
  }
}
