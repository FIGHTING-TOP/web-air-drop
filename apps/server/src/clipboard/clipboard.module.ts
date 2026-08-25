import { Module } from '@nestjs/common';
import { ClipboardController } from './clipboard.controller';
import { ClipboardService } from './clipboard.service';

@Module({
  controllers: [ClipboardController],
  providers: [ClipboardService],
})
export class ClipboardModule {}
