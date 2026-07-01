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
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
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

// ── Reusable response-shape classes for Swagger ──────────────────────────────
// These are plain classes with @ApiProperty decorators — they are never
// instantiated at runtime, they only exist to generate accurate docs.

import { ApiProperty } from '@nestjs/swagger';

class WalletShape {
  @ApiProperty({ example: 'wallet_clx...' }) id: string;
  @ApiProperty({
    example: 0,
    description: 'Balance in kobo (divide by 100 for Naira)',
  }) balanceKobo: number;
}

class UserShape {
  @ApiProperty({ example: 'usr_clx...' }) id: string;
  @ApiProperty({ example: 'Ada Obi' }) fullName: string;
  @ApiProperty({ example: 'ada@example.com' }) email: string;
  @ApiProperty({ example: '+2348012345678', nullable: true }) phone: string | null;
  @ApiProperty({ example: null, nullable: true }) avatarUrl: string | null;
  @ApiProperty({ example: true }) isEmailVerified: boolean;
  @ApiProperty({ example: 100 }) reputationScore: number;
  @ApiProperty({ type: WalletShape, nullable: true }) wallet: WalletShape | null;
}

class AuthResponseShape {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiJ9...' }) accessToken: string;
  @ApiProperty({ example: false }) isNewUser: boolean;
  @ApiProperty({ type: UserShape }) user: UserShape;
}

class MessageShape {
  @ApiProperty({ example: 'Operation completed successfully.' }) message: string;
}

class ReceivedShape {
  @ApiProperty({ example: true }) received: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<AppConfig>,
  ) {}

  // ── Registration ────────────────────────────────────────────────────────────

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description:
      'Creates a user account and wallet, then sends a 6-digit OTP to the supplied ' +
      'email address. The user must verify the OTP via `POST /auth/verify-email` before ' +
      'they can log in.',
  })
  @ApiCreatedResponse({
    description: 'Account created — OTP sent to email.',
    schema: {
      example: {
        message: 'Account created. Check your email for the verification code.',
        email: 'ada@example.com',
      },
    },
  })
  @ApiConflictResponse({ description: 'Email or phone number already in use.' })
  @ApiBadRequestResponse({
    description: 'Validation error (missing / invalid fields).',
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // ── Email verification ───────────────────────────────────────────────────────

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email with OTP',
    description:
      'Accepts the 6-digit OTP sent during registration. On success the account is ' +
      'activated and a JWT is returned so the user is immediately logged in.',
  })
  @ApiOkResponse({ type: AuthResponseShape })
  @ApiBadRequestResponse({
    description: 'OTP is invalid, expired, or wrong format.',
  })
  verifyEmail(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyEmail(dto);
  }

  // ── Resend OTP ───────────────────────────────────────────────────────────────

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend email verification OTP',
    description:
      'Generates a fresh 6-digit OTP and sends it to the user\'s email. ' +
      'The previous OTP is invalidated. Returns a generic success message ' +
      'regardless of whether the email exists (prevents user enumeration).',
  })
  @ApiOkResponse({ type: MessageShape })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  // ── Login ────────────────────────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Email + password login',
    description: 'Authenticates with email and password. Returns a JWT on success.',
  })
  @ApiOkResponse({ type: AuthResponseShape })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  @ApiBadRequestResponse({ description: 'Email not yet verified.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // ── Google OAuth — idToken (legacy popup flow) ───────────────────────────────

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Google sign-in via ID token (popup / One Tap)',
    description:
      'Accepts a Google ID token obtained from the Google Identity Services SDK ' +
      'running in the browser. Verifies it server-side, creates an account if ' +
      'the email is new, and returns a JWT.\n\n' +
      '> **Prefer the redirect flow** (`GET /auth/google`) for new integrations — ' +
      'it avoids the FedCM/One Tap deprecation warnings entirely.',
  })
  @ApiOkResponse({ type: AuthResponseShape })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired Google ID token.' })
  googleAuth(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto.idToken);
  }

  // ── Google OAuth — redirect flow, step 1 ────────────────────────────────────

  @Get('google')
  @ApiOperation({
    summary: 'Initiate Google OAuth redirect',
    description:
      'Redirects the browser to Google\'s consent screen. ' +
      'After the user grants consent, Google redirects back to ' +
      '`GET /auth/google/callback`.\n\n' +
      '**Usage from the frontend:**\n```js\nwindow.location.href = `${API_URL}/auth/google`\n```',
  })
  @ApiExcludeEndpoint(false) // keep it visible even though it returns a redirect
  googleRedirect(@Res() res: Response) {
    const backendUrl = this.config.get('backendUrl', { infer: true });
    const redirectUri = `${backendUrl}/api/v1/auth/google/callback`;
    const url = this.authService.buildGoogleAuthUrl(redirectUri);
    return res.redirect(url);
  }

  // ── Google OAuth — redirect flow, step 2 (callback) ─────────────────────────

  @Get('google/callback')
  @ApiOperation({
    summary: 'Google OAuth callback (internal)',
    description:
      'This endpoint is called **by Google**, not directly by your frontend. ' +
      'It exchanges the one-time `code` for tokens, upserts the user, then ' +
      'redirects the browser to `${FRONTEND_URL}/auth/callback?token=...&isNewUser=...`.\n\n' +
      'Register this URL as an **Authorized redirect URI** in Google Cloud Console:\n' +
      '`https://ajo-server.onrender.com/api/v1/auth/google/callback`',
  })
  @ApiQuery({ name: 'code', required: false, description: 'Authorization code from Google' })
  @ApiQuery({ name: 'error', required: false, description: 'Error string if user cancelled' })
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
      const result = await this.authService.googleAuthRedirect(code, redirectUri);

      const params = new URLSearchParams({
        token: result.accessToken,
        isNewUser: String(result.isNewUser),
      });

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

  // ── Forgot password ──────────────────────────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset',
    description:
      'Sends a password-reset link to the email if an account exists. ' +
      'Returns a generic message regardless (prevents user enumeration).',
  })
  @ApiOkResponse({ type: MessageShape })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // ── Reset password ───────────────────────────────────────────────────────────

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password with token',
    description:
      'Consumes the one-time token from the reset email and sets a new password. ' +
      'The token is invalidated after use.',
  })
  @ApiOkResponse({ type: MessageShape })
  @ApiBadRequestResponse({ description: 'Token is invalid or expired.' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ── Get current user ─────────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Get authenticated user profile',
    description: 'Returns the current user\'s profile and wallet balance. Requires a valid JWT.',
  })
  @ApiOkResponse({ type: UserShape })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  getMe(@CurrentUser() user: { id: string }) {
    return this.authService.getMe(user.id);
  }

  // ── Complete profile (Google OAuth users) ────────────────────────────────────

  @Patch('complete-profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete profile (Google OAuth users)',
    description:
      'Google OAuth accounts are created without a phone number since Google ' +
      "doesn't provide one. This endpoint lets those users add their phone number " +
      'after first sign-in. The `isNewUser` flag in the auth response indicates ' +
      'whether this step is required.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        message: 'Profile completed.',
        user: { id: 'usr_clx...', phone: '+2348012345678' },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid phone number format.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  completeProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: CompleteProfileDto,
  ) {
    return this.authService.completeProfile(user.id, dto.phone);
  }
}
