import { Controller, Get } from '@nestjs/common';
import type { IceConfigResponse, IceServerConfig } from '@airdrop/shared';

@Controller('api/ice')
export class IceController {
  @Get()
  getIce(): IceConfigResponse {
    const iceServers: IceServerConfig[] = [];

    const stunUrls = (process.env.STUN_URLS ?? 'stun:stun.l.google.com:19302')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (stunUrls.length > 0) {
      iceServers.push({ urls: stunUrls.length === 1 ? stunUrls[0]! : stunUrls });
    }

    const turnUrls = (process.env.TURN_URLS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (turnUrls.length > 0) {
      iceServers.push({
        urls: turnUrls.length === 1 ? turnUrls[0]! : turnUrls,
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      });
    }

    return { iceServers };
  }
}
