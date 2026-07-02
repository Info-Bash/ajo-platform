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
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  FundWalletDto,
  TransferDto,
  GetTransactionsDto,
} from './dto/wallet.dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  /**
   * GET /api/v1/wallet
   * Returns current user's wallet balance and account number.
   */
  @Get()
  getWallet(@CurrentUser() user: { id: string }) {
    return this.walletService.getWallet(user.id);
  }

  /**
   * GET /api/v1/wallet/transactions
   * Paginated transaction history. Optional ?type= filter.
   */
  @Get('transactions')
  getTransactions(
    @CurrentUser() user: { id: string },
    @Query() dto: GetTransactionsDto,
  ) {
    return this.walletService.getTransactions(user.id, dto);
  }

  /**
   * GET /api/v1/wallet/lookup/:accountNumber
   * Preview a recipient before confirming a transfer.
   * Returns name + avatar — no balance info exposed.
   */
  @Get('lookup/:accountNumber')
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
  fundWallet(
    @CurrentUser() user: { id: string },
    @Body() dto: FundWalletDto,
  ) {
    return this.walletService.fundWallet(user.id, dto);
  }

  /**
   * POST /api/v1/wallet/transfer
   * Internal transfer between two Ajo users by account number.
   * Double-entry: DEBIT sender + CREDIT recipient atomically.
   */
  @Post('transfer')
  @HttpCode(HttpStatus.OK)
  transfer(
    @CurrentUser() user: { id: string }, @Body() dto: TransferDto
  ) {
    return this.walletService.transfer(user.id, dto);
  }
}
