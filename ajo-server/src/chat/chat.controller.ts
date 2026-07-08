import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SendMessageDto, GetMessagesDto } from './dto/chat.dto';

@ApiTags('Chat')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
@Controller('chat/groups/:groupId')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages')
  @ApiOperation({
    summary: 'List group chat messages',
    description:
      'Paginated, newest page first but oldest-first within the page. ' +
      'Includes both USER and SYSTEM (automatic update) messages.',
  })
  @ApiOkResponse()
  @ApiForbiddenResponse({ description: 'Not a member of this group.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  listMessages(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Query() dto: GetMessagesDto,
  ) {
    return this.chatService.listMessages(user.id, groupId, dto);
  }

  @Post('messages')
  @ApiOperation({ summary: 'Send a message to the group chat' })
  @ApiCreatedResponse()
  @ApiForbiddenResponse({ description: 'Not a member of this group.' })
  @ApiNotFoundResponse({ description: 'Group not found.' })
  sendMessage(
    @CurrentUser() user: { id: string },
    @Param('groupId') groupId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, groupId, dto.content);
  }
}
