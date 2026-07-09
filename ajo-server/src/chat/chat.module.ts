import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';

// RealtimeService is provided by the @Global() RealtimeModule (see
// realtime.module.ts) so it doesn't need to be imported here.
@Module({
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
