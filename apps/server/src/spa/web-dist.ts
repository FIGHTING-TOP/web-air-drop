import { existsSync } from 'fs';
import { resolve } from 'path';

/** Resolve apps/web/dist relative to compiled server (apps/server/dist). */
export function resolveWebDist(): string {
  if (process.env.WEB_DIST) {
    return resolve(process.env.WEB_DIST);
  }
  // dist/main.js → ../../web/dist
  return resolve(__dirname, '../../../web/dist');
}

export function webDistExists(): boolean {
  return existsSync(resolveWebDist());
}
