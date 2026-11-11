import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  isValidClipboardId,
  normalizeClipboardId,
  type ClipboardFileMeta,
  type ClipboardPayload,
  type ClipboardSummary,
} from '@airdrop/shared';
import { createReadStream, existsSync } from 'fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'fs/promises';
import * as path from 'path';
import { randomBytes } from 'crypto';
import type { UploadedFile } from './uploaded-file';

const MAX_TEXT_BYTES = 100 * 1024;
const MAX_FILE_BYTES = Number(process.env.FILE_MAX_BYTES ?? 100 * 1024 * 1024);

@Injectable()
export class ClipboardService {
  private readonly root: string;

  constructor() {
    this.root = process.env.STORAGE_DIR
      ? path.resolve(process.env.STORAGE_DIR)
      : path.resolve(process.cwd(), '../../staticStorage');
  }

  private dir(id: string): string {
    return path.join(this.root, id);
  }

  private metaPath(id: string): string {
    return path.join(this.dir(id), 'meta.json');
  }

  private filesDir(id: string): string {
    return path.join(this.dir(id), 'files');
  }

  private assertId(raw: string): string {
    const id = normalizeClipboardId(raw);
    if (!isValidClipboardId(id)) {
      throw new BadRequestException('Invalid clipboard id');
    }
    return id;
  }

  private empty(id: string): ClipboardPayload {
    return { id, text: '', files: [], updatedAt: 0 };
  }

  async get(rawId: string): Promise<ClipboardPayload> {
    const id = this.assertId(rawId);
    const metaFile = this.metaPath(id);
    if (!existsSync(metaFile)) {
      return this.empty(id);
    }
    const raw = await readFile(metaFile, 'utf8');
    const data = JSON.parse(raw) as ClipboardPayload;
    return {
      id,
      text: data.text ?? '',
      files: data.files ?? [],
      updatedAt: data.updatedAt ?? 0,
    };
  }

  async listAll(): Promise<ClipboardSummary[]> {
    if (!existsSync(this.root)) return [];

    const entries = await readdir(this.root, { withFileTypes: true });
    const summaries: ClipboardSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!isValidClipboardId(entry.name)) continue;

      const payload = await this.get(entry.name);
      if (!payload.text && payload.files.length === 0 && payload.updatedAt === 0) {
        // Empty placeholder dirs without meta — skip
        if (!existsSync(this.metaPath(entry.name))) continue;
      }

      const text = payload.text ?? '';
      summaries.push({
        id: payload.id,
        hasText: text.length > 0,
        textPreview: text.slice(0, 80),
        fileCount: payload.files.length,
        totalSize: payload.files.reduce((sum, f) => sum + (f.size || 0), 0),
        updatedAt: payload.updatedAt,
      });
    }

    summaries.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return summaries;
  }

  async batchDelete(rawIds: string[]): Promise<{ deleted: string[] }> {
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      throw new BadRequestException('ids are required');
    }
    const deleted: string[] = [];
    for (const raw of rawIds) {
      const id = this.assertId(raw);
      await this.clearAll(id);
      deleted.push(id);
    }
    return { deleted };
  }

  private async ensureDirs(id: string) {
    await mkdir(this.filesDir(id), { recursive: true });
  }

  private async writeMeta(payload: ClipboardPayload) {
    await this.ensureDirs(payload.id);
    payload.updatedAt = Date.now();
    await writeFile(this.metaPath(payload.id), JSON.stringify(payload, null, 2), 'utf8');
    return payload;
  }

  async setText(rawId: string, text: string): Promise<ClipboardPayload> {
    const id = this.assertId(rawId);
    if (Buffer.byteLength(text, 'utf8') > MAX_TEXT_BYTES) {
      throw new BadRequestException('Text exceeds 100KB limit');
    }
    const current = await this.get(id);
    current.text = text;
    return this.writeMeta(current);
  }

  async clearText(rawId: string): Promise<ClipboardPayload> {
    const id = this.assertId(rawId);
    const current = await this.get(id);
    current.text = '';
    if (!current.files.length && !current.text) {
      await this.clearAll(id);
      return this.empty(id);
    }
    return this.writeMeta(current);
  }

  private safeFileName(name: string): string {
    return name.replace(/[^\w.\-()\u4e00-\u9fff]+/g, '_').slice(0, 120) || 'file';
  }

  private newFileId(): string {
    return randomBytes(8).toString('hex');
  }

  async addFiles(
    rawId: string,
    files: UploadedFile[],
  ): Promise<ClipboardPayload> {
    const id = this.assertId(rawId);
    if (!files?.length) {
      throw new BadRequestException('No files uploaded');
    }
    for (const f of files) {
      if (f.size > MAX_FILE_BYTES) {
        throw new BadRequestException(
          `File ${f.originalname} exceeds ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB limit`,
        );
      }
    }

    await this.ensureDirs(id);
    const current = await this.get(id);

    for (const f of files) {
      const fileId = this.newFileId();
      const safe = this.safeFileName(f.originalname);
      const storedName = `${fileId}__${safe}`;
      const dest = path.join(this.filesDir(id), storedName);
      await writeFile(dest, f.buffer);
      const meta: ClipboardFileMeta = {
        id: fileId,
        name: f.originalname || safe,
        mime: f.mimetype || 'application/octet-stream',
        size: f.size,
        storedName,
      };
      current.files.push(meta);
    }

    return this.writeMeta(current);
  }

  async getFileStream(rawId: string, fileId: string) {
    const id = this.assertId(rawId);
    const current = await this.get(id);
    const file = current.files.find((f) => f.id === fileId);
    if (!file) throw new NotFoundException('File not found');
    const full = path.join(this.filesDir(id), file.storedName);
    if (!existsSync(full)) throw new NotFoundException('File missing on disk');
    return {
      stream: createReadStream(full),
      meta: file,
    };
  }

  async deleteFile(rawId: string, fileId: string): Promise<ClipboardPayload> {
    const id = this.assertId(rawId);
    const current = await this.get(id);
    const file = current.files.find((f) => f.id === fileId);
    if (!file) throw new NotFoundException('File not found');

    const full = path.join(this.filesDir(id), file.storedName);
    if (existsSync(full)) {
      await rm(full, { force: true });
    }
    current.files = current.files.filter((f) => f.id !== fileId);

    if (!current.files.length && !current.text) {
      await this.clearAll(id);
      return this.empty(id);
    }
    return this.writeMeta(current);
  }

  async clearAll(rawId: string): Promise<{ ok: true }> {
    const id = this.assertId(rawId);
    const dir = this.dir(id);
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
    }
    return { ok: true };
  }
}
