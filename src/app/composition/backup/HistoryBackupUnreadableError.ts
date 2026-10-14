import { copy } from '../../../shared/presentation/i18n/copy';

export class HistoryBackupUnreadableError extends Error {
  public constructor() {
    super(copy.deviceStorage.backupUnreadable);
    this.name = 'HistoryBackupUnreadableError';
  }
}
