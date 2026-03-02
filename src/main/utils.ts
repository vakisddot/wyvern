import crypto from 'crypto';

export function generateId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function timestamp(): number {
  return Date.now();
}
