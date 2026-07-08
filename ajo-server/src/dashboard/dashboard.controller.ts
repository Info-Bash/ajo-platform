import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Home dashboard summary',
    description:
      'Wallet balance, group counts, the single nearest upcoming contribution ' +
      'due and payout owed across all groups, and the 5 most recent transactions.',
  })
  @ApiOkResponse()
  getSummary(@CurrentUser() user: { id: string }) {
    return this.dashboardService.getSummary(user.id);
  }
}
