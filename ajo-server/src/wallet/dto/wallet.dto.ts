import {
  IsInt,
  IsPositive,
  IsString,
  IsOptional,
  IsNotEmpty,
  Min,
  IsIn,
  IsNumber,
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
    description: 'Amount in **Naira** to transfer. Minimum ₦1.',
    minimum: 1,
  })
  @IsNumber()
  @Min(1, { message: 'Amount must be at least ₦1' })
  amount: number;

  @ApiPropertyOptional({
    example: 'For ajo round 3',
    description: 'Optional note attached to the transaction.',
  })
  @IsString()
  @IsOptional()
  description?: string;
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
