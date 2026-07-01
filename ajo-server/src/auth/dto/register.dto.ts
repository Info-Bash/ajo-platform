import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Abu Bashir', description: 'Full name (2–100 characters)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: 'bash@example.com' })
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @ApiProperty({ example: '+2348012345678', description: 'Phone number (10–14 digits, optional + prefix)' })
  @IsString()
  @Matches(/^\+?[0-9]{10,14}$/, {
    message: 'Enter a valid phone number (10–14 digits)',
  })
  phone: string;

  @ApiProperty({
    example: 'SecurePass1',
    description:
      'Min 8 characters, at least one uppercase letter and one number',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  password: string;
}
