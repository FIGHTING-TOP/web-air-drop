import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ClipboardService } from './clipboard.service';
import type { UploadedFile } from './uploaded-file';

@Controller('api/clipboard')
export class ClipboardController {
  constructor(private readonly clipboard: ClipboardService) {}

  /** List all clipboard IDs (must be before :id). */
  @Get()
  listAll() {
    return this.clipboard.listAll();
  }

  @Post('batch-delete')
  batchDelete(@Body() body: { ids?: string[] }) {
    return this.clipboard.batchDelete(body?.ids ?? []);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.clipboard.get(id);
  }

  @Put(':id/text')
  setText(@Param('id') id: string, @Body() body: { text?: string }) {
    return this.clipboard.setText(id, body?.text ?? '');
  }

  @Delete(':id/text')
  clearText(@Param('id') id: string) {
    return this.clipboard.clearText(id);
  }

  @Post(':id/files')
  async upload(@Param('id') id: string, @Req() req: FastifyRequest) {
    const uploaded: UploadedFile[] = [];

    const parts = req.files();
    for await (const part of parts) {
      if (part.type !== 'file') continue;
      const buffer = await part.toBuffer();
      uploaded.push({
        originalname: part.filename || 'file',
        mimetype: part.mimetype || 'application/octet-stream',
        size: buffer.byteLength,
        buffer,
      });
    }

    return this.clipboard.addFiles(id, uploaded);
  }

  @Get(':id/files/:fileId')
  async download(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Res() res: FastifyReply,
  ) {
    const { stream, meta } = await this.clipboard.getFileStream(id, fileId);
    return res
      .header('Content-Type', meta.mime)
      .header(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
      )
      .send(stream);
  }

  @Delete(':id/files/:fileId')
  deleteFile(@Param('id') id: string, @Param('fileId') fileId: string) {
    return this.clipboard.deleteFile(id, fileId);
  }

  @Delete(':id')
  clearAll(@Param('id') id: string) {
    return this.clipboard.clearAll(id);
  }
}
