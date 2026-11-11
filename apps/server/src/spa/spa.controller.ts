import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { resolveWebDist } from './web-dist';

/** Serve React SPA shell for known client routes. */
@Controller()
export class SpaController {
  @Get()
  root(@Res() res: FastifyReply) {
    return this.sendIndex(res);
  }

  @Get('airdrop')
  airdrop(@Res() res: FastifyReply) {
    return this.sendIndex(res);
  }

  @Get('manage/list')
  manageList(@Res() res: FastifyReply) {
    return this.sendIndex(res);
  }

  @Get('manage/:id')
  manageDetail(@Res() res: FastifyReply) {
    return this.sendIndex(res);
  }

  /** Clipboard room: /:id (must stay after named SPA routes). */
  @Get(':id')
  clipboardRoom(@Res() res: FastifyReply) {
    return this.sendIndex(res);
  }

  private sendIndex(res: FastifyReply) {
    const indexHtml = join(resolveWebDist(), 'index.html');
    if (!existsSync(indexHtml)) {
      return res
        .status(503)
        .type('text/plain')
        .send('Web dist not found. Run web build first.');
    }
    return res.type('text/html').send(createReadStream(indexHtml));
  }
}
