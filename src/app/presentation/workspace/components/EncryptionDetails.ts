import type { EncryptionDetailsRow } from './EncryptionDetailsRow';
import type { EncryptionDetailsSecret } from './EncryptionDetailsSecret';

export type EncryptionDetails = {
  note?: string;
  rows: EncryptionDetailsRow[];
  secrets: EncryptionDetailsSecret[];
  status: 'missing' | 'public' | 'ready';
  subtitle?: string;
  title: string;
};
