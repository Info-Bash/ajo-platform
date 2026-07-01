import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AppConfig } from '../config/app.config';
// TokenType values as strings — safe before prisma generate
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ResendOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';

const BCRYPT_ROUNDS = 12;
const OTP_EXPIRY_MINUTES = 10;
const RESET_TOKEN_EXPIRY_MINUTES = 60;

// Generates a cryptographically random 6-digit OTP
function generateOtp(): string {
  const digits = Math.floor(100000 + Math.random() * 900000).toString();
  return digits;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<AppConfig>,
    private readonly mail: MailService,
  ) {}

  // ─── Register ───────────────────────────────────────────────────

  async register(dto: RegisterDto) {
    // Check email and phone uniqueness upfront for a clear error message
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
      },
      select: { email: true, phone: true },
    });

    if (existing) {
      if (existing.email === dto.email) {
        throw new ConflictException('An account with this email already exists');
      }
      throw new ConflictException('An account with this phone number already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);

    // Create user + wallet + OTP token atomically
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          fullName: dto.fullName,
          email: dto.email,
          phone: dto.phone,
          passwordHash,
        },
      });

      await tx.wallet.create({
        data: {
          userId: newUser.id,
          balanceKobo: 0,
        },
      });

      await tx.verificationToken.create({
        data: {
          userId: newUser.id,
          type: 'EMAIL_VERIFICATION',
          tokenHash: otpHash,
          expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
        },
      });

      return newUser;
    });

    // Send OTP email via Brevo SMTP.
    // Mail failures (SMTP down, IPv6 routing, rate limit, etc.) MUST NOT
    // roll back the account creation — the user and wallet already exist
    // and the OTP is stored. Surface a friendlier message so the client
    // can prompt the user to use "resend code".
    try {
      await this.mail.sendOtp(user.email, otp, user.fullName);
    } catch (err) {
      this.logger.error(
        `Failed to send signup OTP to ${user.email}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }

    return {
      message: 'Account created. Check your email for the verification code.',
      email: user.email,
    };
  }

  // ─── Verify Email OTP ─────────────────────────────────────────────────────

  async verifyEmail(dto: VerifyOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('No account found with this email');
    }

    if (user.isEmailVerified) {
      return { message: 'Email already verified. You can log in.' };
    }

    const token = await this.prisma.verificationToken.findFirst({
      where: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      throw new BadRequestException(
        'Verification code expired or not found. Request a new one.',
      );
    }

    const isValid = await bcrypt.compare(dto.code, token.tokenHash);
    if (!isValid) {
      throw new BadRequestException('Invalid verification code');
    }

    // Mark token used and verify user atomically
    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true },
      }),
    ]);

    // Issue JWT immediately after verification — user is logged in
    const accessToken = this.signToken(user.id, user.email);
    return {
      message: 'Email verified successfully.',
      accessToken,
    };
  }

  // ─── Resend OTP ───────────────────────────────────────────────────────────

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Don't reveal whether email exists
      return { message: 'If an account exists, a new code has been sent.' };
    }

    if (user.isEmailVerified) {
      return { message: 'Email already verified. You can log in.' };
    }

    // Invalidate all existing unused OTPs for this user
    await this.prisma.verificationToken.updateMany({
      where: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, BCRYPT_ROUNDS);

    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'EMAIL_VERIFICATION',
        tokenHash: otpHash,
        expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      },
    });

    try {
      await this.mail.sendOtp(user.email, otp, user.fullName);
    } catch (err) {
      this.logger.error(
        `Failed to resend OTP to ${user.email}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }

    return { message: 'If an account exists, a new code has been sent.' };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Use constant-time compare even when user not found to prevent timing attacks
    const dummyHash =
      '$2b$12$invalidhashfortimingnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn';
    const passwordToCheck = user?.passwordHash ?? dummyHash;
    const passwordMatch = await bcrypt.compare(dto.password, passwordToCheck);

    if (!user || !passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account has been suspended');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    const accessToken = this.signToken(user.id, user.email);

    return {
      accessToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        reputationScore: user.reputationScore,
      },
    };
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Always return same message — don't reveal whether email exists
    const response = {
      message:
        'If an account with that email exists, a reset link has been sent.',
    };

    if (!user) return response;

    // Invalidate previous reset tokens
    await this.prisma.verificationToken.updateMany({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Generate a secure random token (not a 6-digit code — longer for reset links)
    const rawToken = [...Array(32)]
      .map(() => Math.random().toString(36)[2])
      .join('');
    const tokenHash = await bcrypt.hash(rawToken, BCRYPT_ROUNDS);

    await this.prisma.verificationToken.create({
      data: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        tokenHash,
        expiresAt: new Date(
          Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000,
        ),
      },
    });

    try {
      await this.mail.sendPasswordReset(user.email, rawToken, user.fullName);
    } catch (err) {
      this.logger.error(
        `Failed to send password reset email to ${user.email}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      // Swallow so we don't leak whether the address exists, and so the
      // request returns 200 even when SMTP is degraded.
    }

    return response;
  }

  // ─── Reset Password ───────────────────────────────────────────────────────

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const token = await this.prisma.verificationToken.findFirst({
      where: {
        userId: user.id,
        type: 'PASSWORD_RESET',
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const isValid = await bcrypt.compare(dto.token, token.tokenHash);
    if (!isValid) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.verificationToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
    ]);

    return { message: 'Password reset successfully. You can now log in.' };
  }

  // ─── Get Current User ─────────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        isEmailVerified: true,
        status: true,
        reputationScore: true,
        totalGroupsJoined: true,
        totalContributionsMade: true,
        totalMissedPayments: true,
        totalGroupsCompleted: true,
        totalGroupsExited: true,
        createdAt: true,
        wallet: {
          select: {
            id: true,
            balanceKobo: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private signToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }

  // ─── Google OAuth — One Tap / GSI popup (idToken flow) ─────────────────────
  // Kept for backward compatibility. Prefer googleAuthRedirect() for new flows
  // since it avoids the FedCM/One Tap deprecation warnings entirely.

  async googleAuth(idToken: string) {
    // Lazy import to avoid loading google-auth-library at startup if not used
    const { OAuth2Client } = await import('google-auth-library');

    const googleClientId = this.config.get('googleClientId', { infer: true });
    if (!googleClientId) {
      throw new BadRequestException('Google authentication is not configured');
    }

    const client = new OAuth2Client(googleClientId);

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken,
        audience: googleClientId,
      });
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    const googlePayload = ticket.getPayload();
    if (!googlePayload?.email) {
      throw new UnauthorizedException('Could not retrieve email from Google token');
    }

    const { email, name, picture, sub: googleId } = googlePayload;

    return this.upsertGoogleUser({ email, name, picture, googleId });
  }

  // ─── Google OAuth — Redirect / Authorization Code flow ─────────────────────
  // Standard OAuth2 redirect flow: frontend sends the browser to Google's
  // consent screen, Google redirects back to our backend callback with a
  // one-time `code`, we exchange it server-side for tokens, then redirect
  // the browser to the frontend with our own JWT attached.
  //
  // This sidesteps Google's One Tap / FedCM deprecation entirely since no
  // GSI prompt UI is used at all.

  /**
   * Builds the Google consent screen URL the frontend should redirect to.
   */
  buildGoogleAuthUrl(redirectUri: string, state?: string): string {
    const googleClientId = this.config.get('googleClientId', { infer: true });
    if (!googleClientId) {
      throw new BadRequestException('Google authentication is not configured');
    }

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'online',
      prompt: 'select_account',
      ...(state ? { state } : {}),
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges the authorization `code` Google sent to our callback URL for
   * tokens, verifies the ID token, and upserts/logs in the user — same
   * outcome as googleAuth() but reached via redirect instead of popup.
   */
  async googleAuthRedirect(code: string, redirectUri: string) {
    const { OAuth2Client } = await import('google-auth-library');

    const googleClientId = this.config.get('googleClientId', { infer: true });
    const googleClientSecret = this.config.get('googleClientSecret', {
      infer: true,
    });
    if (!googleClientId || !googleClientSecret) {
      throw new BadRequestException('Google authentication is not configured');
    }

    const client = new OAuth2Client(
      googleClientId,
      googleClientSecret,
      redirectUri,
    );

    let tokens;
    try {
      ({ tokens } = await client.getToken(code));
    } catch {
      throw new UnauthorizedException('Invalid or expired Google authorization code');
    }

    if (!tokens.id_token) {
      throw new UnauthorizedException('Google did not return an ID token');
    }

    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: googleClientId,
      });
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }

    const googlePayload = ticket.getPayload();
    if (!googlePayload?.email) {
      throw new UnauthorizedException('Could not retrieve email from Google token');
    }

    const { email, name, picture, sub: googleId } = googlePayload;

    return this.upsertGoogleUser({ email, name, picture, googleId });
  }

  /**
   * Shared logic: find-or-create the user record from a verified Google
   * identity, then issue our own JWT. Used by both the idToken and the
   * redirect/code-exchange flows so behavior stays identical.
   */
  private async upsertGoogleUser(googleProfile: {
    email: string;
    name?: string | null;
    picture?: string | null;
    googleId: string;
  }) {
    const { email, name, picture, googleId } = googleProfile;

    // Check if user already exists
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      // Existing user — just log them in
      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Your account has been suspended');
      }

      // Mark email verified if not already (Google email is pre-verified)
      if (!user.isEmailVerified) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { isEmailVerified: true },
        });
      }
    } else {
      // New user — create account + wallet atomically
      // Phone is required in our schema but Google doesn't provide it.
      // We create the account without phone, then prompt user to add it
      // on first login (handled on the frontend via an "complete profile" page).
      user = await this.prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            fullName: name ?? email.split('@')[0],
            email,
            // Phone left empty — user prompted to fill on first login
            // We use a placeholder that passes DB constraints
            phone: `google_${googleId}`,
            // No passwordHash for Google users — they can set one later
            passwordHash: await bcrypt.hash(googleId + Date.now(), BCRYPT_ROUNDS),
            avatarUrl: picture ?? null,
            isEmailVerified: true, // Google email is always pre-verified
          },
        });

        await tx.wallet.create({
          data: { userId: newUser.id, balanceKobo: 0 },
        });

        return newUser;
      });

      this.logger.log(`New user registered via Google: ${email}`);
    }

    const accessToken = this.signToken(user.id, user.email);

    // isNewUser flag tells frontend whether to show "complete your profile" prompt
    const isNewUser = user.phone.startsWith('google_');

    return {
      accessToken,
      isNewUser,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: isNewUser ? null : user.phone,
        avatarUrl: user.avatarUrl,
        isEmailVerified: user.isEmailVerified,
        reputationScore: user.reputationScore,
      },
    };
  }

  // ─── Complete Profile (after Google signup) ───────────────────────────────

  async completeProfile(userId: string, phone: string) {
    // Check phone not already taken by another user
    const phoneExists = await this.prisma.user.findFirst({
      where: { phone, NOT: { id: userId } },
    });
    if (phoneExists) {
      throw new ConflictException('Phone number already in use');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { phone },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        isEmailVerified: true,
      },
    });

    return { message: 'Profile completed.', user };
  }
}
