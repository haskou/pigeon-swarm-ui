import type { SecurityAudit } from './SecurityAudit';

export type SecurityAuditState = {
  audit: SecurityAudit | null;
  devicesFailed: boolean;
  /** Reloads every source, e.g. after a contact was verified. */
  refresh: () => void;
};
