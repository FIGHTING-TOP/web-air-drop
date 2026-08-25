import { Module } from '@nestjs/common';
import { ClipboardModule } from './clipboard/clipboard.module';
import { HealthController } from './health.controller';
import { IceController } from './ice.controller';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';
import { SignalingGateway } from './signaling.gateway';

@Module({
  imports: [ClipboardModule],
  controllers: [HealthController, RoomsController, IceController],
  providers: [RoomsService, SignalingGateway],
})
export class AppModule {}
