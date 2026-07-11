import {
  EncryptedPayload,
  PublicKey,
  StringValueObject,
  SymmetricKey,
} from '@haskou/value-objects';
import { useCallback, useState } from 'react';

import type {
  Community,
  ConversationKeyEntry,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { copy } from '../../../../shared/presentation/i18n/copy';

type CommunityKeyDialogInput = {
  community: Community;
  communityKey?: ConversationKeyEntry;
  onSessionUpdated: (session: Session) => void;
  session: Session;
};

export function useCommunityKeyDialog({
  community,
  communityKey,
  onSessionUpdated,
  session,
}: CommunityKeyDialogInput) {
  const [dialog, setDialog] = useState<'add' | 'copy' | null>(null);
  const [encryptedKey, setEncryptedKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);

  const close = useCallback(() => {
    setDialog(null);
    setEncryptedKey('');
    setError(null);
    setInput('');
    setSaving(false);
  }, []);

  const openAdd = useCallback(() => {
    setError(null);
    setDialog('add');
  }, []);

  const openCopy = useCallback(() => {
    if (!communityKey) {
      setError(copy.chat.copyPrivateKeyUnavailable);
      setDialog('copy');

      return;
    }

    try {
      const encrypted = PublicKey.fromPEM(
        session.identity.encryptedKeyPair.publicKey,
      )
        .encrypt(JSON.stringify(communityKey))
        .toString();

      setEncryptedKey(encrypted);
      setError(null);
    } catch {
      setError(copy.chat.copyPrivateKeyError);
    }

    setDialog('copy');
  }, [communityKey, session.identity.encryptedKeyPair.publicKey]);

  const importKey = useCallback(async () => {
    const encryptedPayload = input.trim();

    if (!encryptedPayload) {
      setError(copy.chat.addPrivateKeyRequired);

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const decrypted = session.keyPair.decrypt(
        new EncryptedPayload(encryptedPayload),
      );
      const parsed = JSON.parse(
        decrypted.toString(),
      ) as Partial<ConversationKeyEntry>;

      if (!isCommunityKeyEntry(parsed, community.id)) {
        throw new Error(copy.chat.addPrivateKeyError);
      }

      SymmetricKey.fromBase64(parsed.key);
      const keyEntry: ConversationKeyEntry = {
        algorithm: 'aes-256-gcm',
        conversationId: community.id,
        createdAt: parsed.createdAt ?? Date.now(),
        key: parsed.key,
        kind: 'community',
        peerIdentityId: parsed.peerIdentityId ?? session.identity.id,
        version: 2,
      };
      const published = await applicationContainer.publishKeychain(session, {
        ...session.keychain,
        conversations: {
          ...session.keychain.conversations,
          [community.id]: keyEntry,
        },
      });

      onSessionUpdated({
        ...session,
        keychain: published.keychain,
        keychainExternalIdentifier: published.keychainExternalIdentifier,
      });
      close();
    } catch {
      setError(copy.chat.addPrivateKeyError);
    } finally {
      setSaving(false);
    }
  }, [close, community.id, input, onSessionUpdated, session]);

  const copyEncryptedKey = useCallback(async () => {
    if (navigator.clipboard && encryptedKey) {
      await navigator.clipboard.writeText(encryptedKey);
    }
  }, [encryptedKey]);

  return {
    close,
    copyEncryptedKey,
    dialog,
    encryptedKey,
    error,
    importKey,
    input,
    openAdd,
    openCopy,
    saving,
    setInput,
  };
}

function isCommunityKeyEntry(
  entry: Partial<ConversationKeyEntry>,
  communityId: string,
): entry is ConversationKeyEntry {
  return (
    !!entry.conversationId &&
    new StringValueObject(
      entry.conversationId,
      Number.MAX_SAFE_INTEGER,
    ).isEqual(new StringValueObject(communityId, Number.MAX_SAFE_INTEGER)) &&
    entry.algorithm === 'aes-256-gcm' &&
    !!entry.key &&
    entry.kind === 'community' &&
    entry.version === 2
  );
}
