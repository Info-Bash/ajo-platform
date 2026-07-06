import {
  IsInt,
  IsPositive,
  IsString,
  IsOptional,
  IsNotEmpty,
  Min,
  IsIn,
  IsNumber,
  Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FundWalletDto {
  @ApiProperty({
    example: 5000,
    description:
      'Amount to fund in **Naira** (not kobo). Minimum ₦100. ' +
      'The server converts to kobo internally before passing to Nomba.',
    minimum: 100,
  })
  @IsNumber()
  @Min(100, { message: 'Minimum funding amount is ₦100' })
  amount: number;
}

export class TransferDto {
  @ApiProperty({
    example: '2025001234',
    description: "Recipient's 10-digit Ajo wallet account number.",
  })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({
    example: 2000,
    description: 'Amount in **Naira** to transfer. Minimum ₦20.',
    minimum: 20,
  })
  @IsNumber()
  @Min(20, { message: 'Amount must be at least ₦20' })
  amount: number;

  @ApiPropertyOptional({
    example: 'For ajo round 3',
    description: 'Optional note attached to the transaction.',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class ResolveBankAccountDto {
  @ApiProperty({
    example: '0554772814',
    description: 'The destination bank account number to verify.',
  })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({
    example: '058',
    description: "The recipient bank's code, from GET /wallet/banks.",
  })
  @IsString()
  @IsNotEmpty()
  bankCode: string;
}

export class WithdrawDto {
  @ApiProperty({
    example: 5000,
    description: 'Amount to withdraw in **Naira**. Minimum ₦100.',
    minimum: 100,
  })
  @IsNumber()
  @Min(100, { message: 'Minimum withdrawal amount is ₦100' })
  amount: number;

  @ApiPropertyOptional({
    description:
      'ID of a previously saved beneficiary to withdraw to. Provide this ' +
      'OR (accountNumber + bankCode), not both.',
    example: 'clx-beneficiary-id',
  })
  @IsString()
  @IsOptional()
  beneficiaryId?: string;

  @ApiPropertyOptional({
    example: '0554772814',
    description: 'Destination account number. Required if beneficiaryId is not provided.',
  })
  @IsString()
  @IsOptional()
  accountNumber?: string;

  @ApiPropertyOptional({
    example: '058',
    description: 'Destination bank code. Required if beneficiaryId is not provided.',
  })
  @IsString()
  @IsOptional()
  bankCode?: string;

  @ApiProperty({
    example: '1234',
    description: "The user's 4-digit transaction PIN.",
  })
  @IsString()
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  pin: string;

  @ApiPropertyOptional({
    example: 'Rent payout',
    description: 'Optional note attached to the transaction.',
  })
  @IsString()
  @IsOptional()
  narration?: string;
}

export class SetTransactionPinDto {
  @ApiProperty({ example: '1234', description: 'New 4-digit transaction PIN.' })
  @IsString()
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  pin: string;

  @ApiPropertyOptional({
    example: '0000',
    description: 'Required only when changing an existing PIN.',
  })
  @IsString()
  @IsOptional()
  @Length(4, 4, { message: 'PIN must be exactly 4 digits' })
  currentPin?: string;
}

export class GetTransactionsDto {
  @ApiPropertyOptional({
    enum: [
      'DEPOSIT',
      'WITHDRAWAL',
      'TRANSFER',
      'CONTRIBUTION',
      'PAYOUT',
      'REVERSAL',
    ],
    description: 'Filter by transaction type. Omit to return all types.',
    example: 'DEPOSIT',
  })
  @IsOptional()
  @IsIn([
    'DEPOSIT',
    'WITHDRAWAL',
    'TRANSFER',
    'CONTRIBUTION',
    'PAYOUT',
    'REVERSAL',
  ])
  type?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Page number (1-based). Defaults to 1.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    description: 'Items per page. Defaults to 20, capped at 100.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
