import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteProfileDto {
  @ApiProperty({
    example: '+2348012345678',
    description: 'Phone number to add to a Google OAuth account (10–14 digits)',
  })
  @IsString()
  @Matches(/^\+?[0-9]{10,14}$/, {
    message: 'Enter a valid phone number (10–14 digits)',
  })
  phone: string;
}
