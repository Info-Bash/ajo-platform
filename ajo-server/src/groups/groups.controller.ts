import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  CreateGroupDto,
  RequestToJoinDto,
  ReviewJoinRequestDto,
  ListPublicGroupsDto,
  InviteUserDto,
} from './dto/groups.dto';

@ApiTags('Groups')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an Ajo group',
    description:
      'Creates a group, its wallet, and its group chat, and adds the ' +
      'creator as the first member (ADMIN, payout order 1).',
  })
  @ApiCreatedResponse()
  @ApiBadRequestResponse({ description: 'Invalid settings (e.g. TESTING frequency in production).' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateGroupDto) {
    return this.groupsService.create(user.id, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: "List groups I'm a member of" })
  @ApiOkResponse()
  getMyGroups(@CurrentUser() user: { id: string }) {
    return this.groupsService.getMyGroups(user.id);
  }

  @Get('public')
  @ApiOperation({
    summary: 'Discover public groups',
    description: 'Public groups still gathering members (PENDING, not yet full).',
  })
  @ApiOkResponse()
  getPublicGroups(@Query() dto: ListPublicGroupsDto) {
    return this.groupsService.getPublicGroups(dto);
  }

  @Get(':groupId')
  @ApiOperation({ summary: 'Get group details' })
  @ApiOkResponse()
  @ApiForbiddenResponse({ description: 'Private group and you are not a member.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  getGroup(@CurrentUser() user: { id: string }, @Param('groupId') groupId: string) {
    return this.groupsService.getGroupDetail(user.id, groupId);
  }

  @Post('join/:inviteCode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Join a private group via invite link/code',
    description: 'Immediate join — no approval needed, since holding the link is the vetting.',
  })
  @ApiOkResponse()
  @ApiBadRequestResponse({ description: 'Group is full, public, or no longer accepting members.' })
  @ApiNotFoundResponse({ description: 'Invalid invite code.' })
  joinByInviteCode(
    @CurrentUser() user: { id: string },
    @Param('inviteCode') inviteCode: string,
  ) {
    return this.groupsService.joinByInviteCode(user.id, inviteCode);
  }

  @Post(':groupId/join-requests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request to join a public group' })
  @ApiOkResponse()
  @ApiBadRequestResponse({ description: 'Group is private, full, or no longer accepting members.' })
  requestToJoin(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Body() dto: RequestToJoinDto,
  ) {
    return this.groupsService.requestToJoin(user.id, groupId, dto);
  }

  @Get(':groupId/join-requests')
  @ApiOperation({ summary: 'List pending join requests (admin only)' })
  @ApiOkResponse()
  @ApiForbiddenResponse({ description: 'Not a group admin.' })
  listJoinRequests(@CurrentUser() user: { id: string }, @Param('groupId') groupId: string) {
    return this.groupsService.listJoinRequests(user.id, groupId);
  }

  @Post(':groupId/join-requests/:requestId/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a join request (admin only)' })
  @ApiOkResponse()
  @ApiForbiddenResponse({ description: 'Not a group admin.' })
  reviewJoinRequest(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewJoinRequestDto,
  ) {
    return this.groupsService.reviewJoinRequest(user.id, groupId, requestId, dto);
  }

  @Post(':groupId/invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Directly invite a specific user (admin only)' })
  @ApiOkResponse()
  @ApiForbiddenResponse({ description: 'Not a group admin.' })
  inviteUser(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Body() dto: InviteUserDto,
  ) {
    return this.groupsService.inviteUser(user.id, groupId, dto);
  }

  @Post(':groupId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually start the group (admin only, MANUAL_START_BY_ADMIN groups)',
    description:
      'Locks membership, assigns final payout order, generates the round ' +
      'schedule, and starts round 1. Requires at least 2 members.',
  })
  @ApiOkResponse()
  @ApiBadRequestResponse({ description: 'Not pending, not manual mode, or fewer than 2 members.' })
  activate(@CurrentUser() user: { id: string }, @Param('groupId') groupId: string) {
    return this.groupsService.activate(user.id, groupId);
  }

  @Delete(':groupId/membership')
  @ApiOperation({ summary: 'Leave a group (only before it activates)' })
  @ApiOkResponse()
  @ApiBadRequestResponse({ description: 'Group has already started.' })
  leaveGroup(@CurrentUser() user: { id: string }, @Param('groupId') groupId: string) {
    return this.groupsService.leaveGroup(user.id, groupId);
  }

  @Delete(':groupId/members/:userId')
  @ApiOperation({ summary: 'Remove a member (admin only, before activation)' })
  @ApiOkResponse()
  @ApiForbiddenResponse({ description: 'Not a group admin.' })
  removeMember(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.groupsService.removeMember(user.id, groupId, targetUserId);
  }

  @Post(':groupId/transfer-admin/:userId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer group admin role to another member' })
  @ApiOkResponse()
  @ApiForbiddenResponse({ description: 'Not a group admin.' })
  transferAdmin(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Param('userId') newAdminUserId: string,
  ) {
    return this.groupsService.transferAdmin(user.id, groupId, newAdminUserId);
  }
}
