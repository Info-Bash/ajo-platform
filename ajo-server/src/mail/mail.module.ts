import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';

@Global() // Global so any module can inject MailService without re-importing
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
