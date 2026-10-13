import type { EncryptionDetailsIdentifier } from './EncryptionDetailsIdentifier';
import type { EncryptionDetailsRow } from './EncryptionDetailsRow';

export type EncryptionDetails = {
  identifiers: EncryptionDetailsIdentifier[];
  note?: string;
  rows: EncryptionDetailsRow[];
  status: 'missing' | 'public' | 'ready';
  subtitle?: string;
  title: string;
};
