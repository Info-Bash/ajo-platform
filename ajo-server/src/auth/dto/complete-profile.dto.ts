import { IsString, Matches } from 'class-validator';

export class CompleteProfileDto {
  @IsString()
  @Matches(/^\+?[0-9]{10,14}$/, {
    message: 'Enter a valid phone number (10–14 digits)',
  })
  phone: string;
}
