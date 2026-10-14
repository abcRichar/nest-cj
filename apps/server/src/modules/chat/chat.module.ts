import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { AdminAiRoleController } from './admin-ai-role.controller';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AiModule],
  controllers: [ChatController, AdminAiRoleController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
