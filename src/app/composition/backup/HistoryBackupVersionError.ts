import { copy } from '../../../shared/presentation/i18n/copy';

export class HistoryBackupVersionError extends Error {
  public constructor() {
    super(copy.deviceStorage.backupVersion);
    this.name = 'HistoryBackupVersionError';
  }
}
