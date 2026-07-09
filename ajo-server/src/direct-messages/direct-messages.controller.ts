import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { DirectMessagesService } from './direct-messages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  SendDirectMessageDto,
  GetDirectMessagesDto,
} from './dto/direct-messages.dto';

@ApiTags('Direct Messages')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
@Controller('messages')
export class DirectMessagesController {
  constructor(private readonly dmService: DirectMessagesService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'List my conversations, most recently active first' })
  @ApiOkResponse()
  listConversations(@CurrentUser() user: { id: string }) {
    return this.dmService.listConversations(user.id);
  }

  @Get(':otherUserId')
  @ApiOperation({
    summary: 'Get my message history with a specific user',
    description: 'Also marks their unread messages to me as read.',
  })
  @ApiOkResponse()
  listMessages(
    @CurrentUser() user: { id: string },
    @Param('otherUserId') otherUserId: string,
    @Query() dto: GetDirectMessagesDto,
  ) {
    return this.dmService.listMessages(user.id, otherUserId, dto);
  }

  @Post(':otherUserId')
  @ApiOperation({
    summary: 'Send a direct message to a specific user',
    description: 'You can only start a new conversation with someone you share an Ajo group with (friends).',
  })
  @ApiCreatedResponse()
  @ApiForbiddenResponse({ description: 'Not friends yet — no shared group.' })
  @ApiBadRequestResponse({ description: 'Cannot message yourself.' })
  @ApiNotFoundResponse({ description: 'User not found.' })
  sendMessage(
    @CurrentUser() user: { id: string },
    @Param('otherUserId') otherUserId: string,
    @Body() dto: SendDirectMessageDto,
  ) {
    return this.dmService.sendMessage(user.id, otherUserId, dto.content);
  }
}
