import { CLIPBOARD_ID_LENGTH, ROOM_CODE_ALPHABET } from './types';
import { generateRoomCode, normalizeRoomCode } from './room-code';

export function generateClipboardId(length = CLIPBOARD_ID_LENGTH): string {
  return generateRoomCode(length);
}

export function normalizeClipboardId(input: string): string {
  return normalizeRoomCode(input);
}

export function isValidClipboardId(input: string): boolean {
  const id = normalizeClipboardId(input);
  if (id.length < 4 || id.length > 16) return false;
  return [...id].every((ch) => ROOM_CODE_ALPHABET.includes(ch));
}
