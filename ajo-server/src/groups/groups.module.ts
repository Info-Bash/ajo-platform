import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsController } from './groups.controller';
import { ChatModule } from '../chat/chat.module';
import { FriendsModule } from '../friends/friends.module';

@Module({
  imports: [ChatModule, FriendsModule],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
