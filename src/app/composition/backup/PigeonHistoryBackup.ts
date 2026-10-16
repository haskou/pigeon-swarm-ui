import { HistoryBackupFile } from '@haskou/pigeon-swarm-crypto';

import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { ContactPinStore } from '../../../contexts/identities/infrastructure/storage/ContactPinStore';
import type { DirectMessageHistoryItem } from '../../../contexts/messages/infrastructure/mailbox/DirectMessageHistoryItem';
import type { DirectMessageMailbox } from '../../../contexts/messages/infrastructure/mailbox/DirectMessageMailbox';
import type { PigeonIdentitiesFacade } from '../identities/PigeonIdentitiesFacade';

import { parseContactPins } from '../../../contexts/identities/domain/ContactPins';
import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../shared/infrastructure/encoding/base64url';
import { HistoryBackupUnreadableError } from './HistoryBackupUnreadableError';

type BackupContent = {
  contacts: unknown;
  history: { conversationId: string; plaintext: string }[];
};

function isHistoryEntry(
  value: unknown,
): value is BackupContent['history'][number] {
  if (typeof value !== 'object' || value === null) return false;

  const { conversationId, plaintext } = value as Record<string, unknown>;

  return typeof conversationId === 'string' && typeof plaintext === 'string';
}

function parseContent(plaintext: Uint8Array): BackupContent {
  let parsed: unknown;

  try {
    parsed = JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    throw new HistoryBackupUnreadableError();
  }

  const { contacts, history } = (parsed ?? {}) as Record<string, unknown>;

  if (!Array.isArray(history) || !history.every(isHistoryEntry)) {
    throw new HistoryBackupUnreadableError();
  }

  return { contacts, history };
}

/**
 * One encrypted file with this identity's direct history and remembered
 * contacts. Exporting asks for the device password again. The file
 * holds stored messages only, never private, session or ratchet keys, and only
 * this identity can open it. Group history is not included.
 */
export class PigeonHistoryBackup {
  public constructor(
    private readonly identities: PigeonIdentitiesFacade,
    private readonly directMessages: DirectMessageMailbox,
    private readonly contactPins: ContactPinStore,
  ) {}

  /** Any file but this identity's current-format backup is unreadable. */
  private opened(session: Session, file: string): Uint8Array {
    try {
      return HistoryBackupFile.open(
        session.masterKey,
        session.identity.id,
        file,
      );
    } catch {
      throw new HistoryBackupUnreadableError();
    }
  }

  public async export(session: Session, password: string): Promise<string> {
    const identityId = session.identity.id;

    await this.identities.confirmLocalUnlock(identityId, password);

    const history = await this.directMessages.exportHistory(session);
    const content: BackupContent = {
      contacts: this.contactPins.load(identityId),
      history: history.map((item) => ({
        conversationId: item.conversationId,
        plaintext: encodeBase64Url(item.plaintext),
      })),
    };

    return HistoryBackupFile.seal(
      session.masterKey,
      identityId,
      new TextEncoder().encode(JSON.stringify(content)),
    );
  }

  /** Restores nothing unless the whole file is this identity's backup. */
  public async restore(session: Session, file: string): Promise<void> {
    const identityId = session.identity.id;
    const content = parseContent(this.opened(session, file));
    const history: DirectMessageHistoryItem[] = content.history.map(
      (entry) => ({
        conversationId: entry.conversationId,
        plaintext: new Uint8Array(decodeBase64Url(entry.plaintext)),
      }),
    );

    await this.directMessages.importHistory(session, history);
    this.contactPins.restore(identityId, parseContactPins(content.contacts));
  }
}
