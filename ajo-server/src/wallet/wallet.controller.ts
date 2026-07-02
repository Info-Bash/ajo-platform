import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  FundWalletDto,
  TransferDto,
  GetTransactionsDto,
} from './dto/wallet.dto';

// ── Response shape classes (Swagger only — never instantiated) ───────────────

class WalletShape {
  @ApiProperty({ example: 'wlt_clx...' }) id: string;
  @ApiProperty({ example: '2025001234' }) accountNumber: string;
  @ApiProperty({ example: 500000, description: 'Balance in kobo' })
  balanceKobo: number;
  @ApiProperty({
    example: 5000,
    description: 'Balance in Naira (balanceKobo / 100)',
  })
  balanceNaira: number;
  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' }) createdAt: string;
}

class FundWalletResponseShape {
  @ApiProperty({ example: 'https://checkout.nomba.com/order/xyz...' }) checkoutLink: string;
  @ApiProperty({ example: 'nomba-order-ref-uuid' }) orderReference: string;
  @ApiProperty({ example: 5000 }) amount: number;
  @ApiProperty({ example: 500000 }) amountKobo: number;
}

class TransactionShape {
  @ApiProperty({ example: 'txn_clx...' }) id: string;
  @ApiProperty({ enum: ['CREDIT', 'DEBIT'] }) direction: string;
  @ApiProperty({
    enum: [
      'DEPOSIT',
      'WITHDRAWAL',
      'TRANSFER',
      'CONTRIBUTION',
      'PAYOUT',
      'REVERSAL',
    ],
  })
  type: string;
  @ApiProperty({ enum: ['PENDING', 'SUCCESSFUL', 'FAILED', 'REVERSED'] }) status: string;
  @ApiProperty({ example: 500000 }) amountKobo: number;
  @ApiProperty({ example: 5000 }) amountNaira: number;
  @ApiPropertyOptional({ example: 'TRF-SND-A1B2C3D4' }) reference?: string;
  @ApiPropertyOptional({ example: 'Transfer to Chidi Obi' }) description?: string;
  @ApiPropertyOptional({ example: 'Chidi Obi' }) counterpartyName?: string;
  @ApiProperty({ example: '2024-01-15T14:30:00.000Z' }) createdAt: string;
}

class PaginationMeta {
  @ApiProperty({ example: 42 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
  @ApiProperty({ example: 3 }) totalPages: number;
  @ApiProperty({ example: true }) hasNextPage: boolean;
}

class TransactionListShape {
  @ApiProperty({ type: [TransactionShape] }) data: TransactionShape[];
  @ApiProperty({ type: PaginationMeta }) meta: PaginationMeta;
}

class LookupResponseShape {
  @ApiProperty({ example: '2025001234' }) accountNumber: string;
  @ApiProperty({ example: 'Ada Obi' }) name: string;
  @ApiPropertyOptional({ example: 'https://...' }) avatarUrl: string | null;
}

class TransferResponseShape {
  @ApiProperty({ example: '₦2,000 sent to Ada Obi' }) message: string;
  @ApiProperty({ example: 'TRF-SND-A1B2C3D4' }) reference: string;
  @ApiProperty({ example: 2000 }) amount: number;
  @ApiProperty({
    example: { name: 'Ada Obi', accountNumber: '2025001234' },
  })
  recipient: { name: string; accountNumber: string };
}

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Wallet')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({
    summary: 'Get wallet balance & account number',
    description:
      "Returns the authenticated user's wallet details including their " +
      'internal account number and current balance in both kobo and Naira.',
  })
  @ApiOkResponse({ type: WalletShape })
  @ApiNotFoundResponse({ description: 'Wallet not found.' })
  getWallet(@CurrentUser() user: { id: string }) {
    return this.walletService.getWallet(user.id);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Get transaction history',
    description:
      'Returns a paginated list of all wallet transactions for the ' +
      'authenticated user, ordered newest first. Filter by `type` to narrow results.',
  })
  @ApiOkResponse({ type: TransactionListShape })
  @ApiNotFoundResponse({ description: 'Wallet not found.' })
  getTransactions(
    @CurrentUser() user: { id: string },
    @Query() dto: GetTransactionsDto,
  ) {
    return this.walletService.getTransactions(user.id, dto);
  }

  @Get('lookup/:accountNumber')
  @ApiOperation({
    summary: 'Look up account by number',
    description:
      'Previews a recipient before confirming a transfer — returns name and ' +
      'avatar only. No balance information is exposed. ' +
      'Use this on the "Confirm recipient" step in the transfer flow.',
  })
  @ApiParam({
    name: 'accountNumber',
    example: '2025001234',
    description: "The recipient's 10-digit Ajo wallet account number.",
  })
  @ApiOkResponse({ type: LookupResponseShape })
  @ApiNotFoundResponse({
    description: 'No Ajo account found with that account number.',
  })
  lookupAccount(@Param('accountNumber') accountNumber: string) {
    return this.walletService.lookupAccount(accountNumber);
  }

  /**
   * POST /api/v1/wallet/fund
   * Creates a Nomba checkout order and returns the checkout link.
   * Frontend redirects user to checkoutLink to complete payment.
   * On success, Nomba fires payment_success webhook → wallet credited.
   */
  @Post('fund')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate wallet funding via Nomba checkout',
    description:
      'Creates a Nomba checkout order and returns a `checkoutLink`. ' +
      'The frontend should redirect the user to this URL to complete payment.\n\n' +
      '**Flow:**\n' +
      '1. Frontend calls `POST /wallet/fund` with the desired amount\n' +
      '2. Server creates a Nomba checkout order + saves a `PendingCheckout` record\n' +
      '3. Frontend redirects user to `checkoutLink`\n' +
      "4. User completes payment on Nomba's hosted page\n" +
      '5. Nomba fires `payment_success` webhook → server credits the wallet\n' +
      '6. Nomba redirects user back to `${FRONTEND_URL}/wallet?status=funded`\n\n' +
      'Checkout links expire after **30 minutes**.',
  })
  @ApiOkResponse({ type: FundWalletResponseShape })
  @ApiBadRequestResponse({ description: 'Amount below minimum (₦100).' })
  @ApiNotFoundResponse({ description: 'Wallet not found.' })
  fundWallet(@CurrentUser() user: { id: string }, @Body() dto: FundWalletDto) {
    return this.walletService.fundWallet(user.id, dto);
  }

  /**
   * POST /api/v1/wallet/transfer
   * Internal transfer between two Ajo users by account number.
   * Double-entry: DEBIT sender + CREDIT recipient atomically.
   */
  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transfer funds to another Ajo user',
    description:
      "Sends money from the authenticated user's wallet to another Ajo " +
      'user identified by their account number.\n\n' +
      '**Double-entry ledger:** creates a `DEBIT` entry on the sender and a ' +
      '`CREDIT` entry on the recipient atomically in a single database transaction. ' +
      'Both entries share the same `journalId` for reconciliation.\n\n' +
      'Use `GET /wallet/lookup/:accountNumber` first to confirm the recipient ' +
      'before calling this endpoint.',
  })
  @ApiOkResponse({ type: TransferResponseShape })
  @ApiBadRequestResponse({
    description:
      'Insufficient balance, self-transfer attempt, or amount below minimum.',
  })
  @ApiNotFoundResponse({ description: 'Sender or recipient wallet not found.' })
  transfer(@CurrentUser() user: { id: string }, @Body() dto: TransferDto) {
    return this.walletService.transfer(user.id, dto);
  }
}
