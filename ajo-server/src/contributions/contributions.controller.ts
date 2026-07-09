import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ContributionsService } from './contributions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Contributions')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
@Controller()
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Get('groups/:groupId/contributions')
  @ApiOperation({ summary: 'List my contributions for a group, across all rounds' })
  @ApiOkResponse()
  @ApiForbiddenResponse({ description: 'Not a member of this group.' })
  listMine(@CurrentUser() user: { id: string }, @Param('groupId') groupId: string) {
    return this.contributionsService.listMyContributions(user.id, groupId);
  }

  @Get('groups/:groupId/schedule')
  @ApiOperation({
    summary: 'Full round-by-round schedule for a group',
    description: 'Every round with its payout recipient and every member\'s contribution status.',
  })
  @ApiOkResponse()
  @ApiForbiddenResponse({ description: 'Not a member of this group.' })
  getSchedule(@CurrentUser() user: { id: string }, @Param('groupId') groupId: string) {
    return this.contributionsService.getGroupSchedule(user.id, groupId);
  }

  @Post('contributions/:contributionId/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pay one of my pending/late contributions' })
  @ApiOkResponse()
  @ApiBadRequestResponse({ description: 'Already paid/defaulted, round closed, or insufficient balance.' })
  @ApiForbiddenResponse({ description: 'Not your contribution.' })
  @ApiNotFoundResponse({ description: 'Contribution not found.' })
  pay(@CurrentUser() user: { id: string }, @Param('contributionId') contributionId: string) {
    return this.contributionsService.payContribution(user.id, contributionId);
  }
}
