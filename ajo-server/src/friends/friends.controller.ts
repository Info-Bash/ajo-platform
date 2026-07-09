import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiProperty,
} from '@nestjs/swagger';
import { FriendsService } from './friends.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class FriendShape {
  @ApiProperty({ example: 'usr_clx...' }) userId: string;
  @ApiProperty({ example: 'Ada Obi' }) fullName: string;
  @ApiProperty({ required: false, example: 'https://...' }) avatarUrl?: string;
  @ApiProperty({ example: 96 }) reputationScore: number;
  @ApiProperty({ example: '2024-01-15T14:30:00.000Z' }) friendsSince: string;
}

@ApiTags('Friends')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Get()
  @ApiOperation({
    summary: 'List friends',
    description:
      'Returns everyone the authenticated user is friends with. Friendships ' +
      'are created automatically when two users become members of the same Ajo group.',
  })
  @ApiOkResponse({ type: [FriendShape] })
  listFriends(@CurrentUser() user: { id: string }) {
    return this.friendsService.listFriends(user.id);
  }
}
