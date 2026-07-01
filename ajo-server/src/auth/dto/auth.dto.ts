import {
  IsEmail,
  IsString,
  Length,
  MinLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: 'bash@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: '482910',
    description: "Exactly 6 digits sent to the user's email",
  })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  @Matches(/^[0-9]{6}$/, { message: 'OTP must contain only digits' })
  code: string;
}

export class ResendOtpDto {
  @ApiProperty({ example: 'bash@example.com' })
  @IsEmail()
  email: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'bash@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'bash@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Reset token received in the password-reset email',
  })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'NewSecurePass1',
    description:
      'Min 8 characters, at least one uppercase letter and one number',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  newPassword: string;
}
