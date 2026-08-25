import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { ClipboardService } from './clipboard.service';

@Controller('api/clipboard')
export class ClipboardController {
  constructor(private readonly clipboard: ClipboardService) {}

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
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  upload(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.clipboard.addFiles(id, files ?? []);
  }

  @Get(':id/files/:fileId')
  async download(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const { stream, meta } = await this.clipboard.getFileStream(id, fileId);
    res.setHeader('Content-Type', meta.mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
    );
    stream.pipe(res);
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
