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

export class FundWalletDto {
  /**
   * Amount to fund in NAIRA (not kobo).
   * Frontend sends naira; we convert to kobo internally.
   * Minimum ₦100 (Nomba minimum checkout amount).
   */
  @IsNumber()
  @Min(100, { message: 'Minimum funding amount is ₦100' })
  amount: number;
}

export class TransferDto {
  /**
   * Recipient's 10-digit Ajo wallet account number.
   * Used to look up the destination wallet for internal transfer.
   */
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  /**
   * Amount in NAIRA to send.
   */
  @IsNumber()
  @Min(1, { message: 'Amount must be at least ₦1' })
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class GetTransactionsDto {
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

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
