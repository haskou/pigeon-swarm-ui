import type { EncryptionDetailsRow } from './EncryptionDetailsDialog';

export function visibleEncryptionRows(
  rows: EncryptionDetailsRow[],
  technicalDetailsVisible: boolean,
): EncryptionDetailsRow[] {
  return technicalDetailsVisible ? rows : rows.filter((row) => !row.technical);
}
