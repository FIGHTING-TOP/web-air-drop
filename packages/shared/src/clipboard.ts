import { CLIPBOARD_ID_LENGTH, ROOM_CODE_ALPHABET } from './types';

const CLIPBOARD_ID_PATTERN = /^[a-zA-Z0-9]+$/;

export function generateClipboardId(length = CLIPBOARD_ID_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

/** Trim only — preserve letter case. */
export function normalizeClipboardId(input: string): string {
  return input.trim();
}

export function isValidClipboardId(input: string): boolean {
  const id = normalizeClipboardId(input);
  return id.length > 0 && CLIPBOARD_ID_PATTERN.test(id);
}
