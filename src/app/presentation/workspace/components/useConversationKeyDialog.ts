import type { Dispatch, SetStateAction } from 'react';

import {
  EncryptedPayload,
  PublicKey,
  SymmetricKey,
} from '@haskou/value-objects';
import { useCallback, useState } from 'react';

import type {
  ConversationKeyEntry,
  ConversationResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';

export interface ConversationKeyDialogController {
  close: () => void;
  copy: () => Promise<void>;
  encryptedKey: string;
  error: string | null;
  importKey: () => Promise<void>;
  input: string;
  mode: 'add' | 'copy' | null;
  openAdd: () => void;
  openCopy: () => void;
  saving: boolean;
  setInput: Dispatch<SetStateAction<string>>;
}

function assertConversationKeyPackage(
  parsed: Partial<ConversationKeyEntry>,
  conversationId: string,
): asserts parsed is ConversationKeyEntry {
  if (parsed.conversationId !== conversationId) {
    throw new Error('Conversation key belongs to another conversation.');
  }

  if (
    parsed.algorithm !== 'aes-256-gcm' ||
    !parsed.key ||
    parsed.version !== 2
  ) {
    throw new Error('Conversation key payload is invalid.');
  }
}

export function useConversationKeyDialog({
  conversation,
  conversationKey,
  onConversationKeyImported,
  peerIdentity,
  peerIdentityId,
  session,
}: {
  conversation?: ConversationResource;
  conversationKey?: ConversationKeyEntry;
  onConversationKeyImported: (keyEntry: ConversationKeyEntry) => Promise<void>;
  peerIdentity?: IdentityResource;
  peerIdentityId?: string;
  session: Session;
}): ConversationKeyDialogController {
  const [mode, setMode] = useState<'add' | 'copy' | null>(null);
  const [encryptedKey, setEncryptedKey] = useState('');
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = useCallback(() => {
    setMode(null);
    setEncryptedKey('');
    setInput('');
    setError(null);
    setSaving(false);
  }, []);

  const openAdd = useCallback(() => {
    setError(null);
    setMode('add');
  }, []);

  const openCopy = useCallback(() => {
    if (!conversation || !conversationKey || !peerIdentity) {
      setError(copy.chat.copyPrivateKeyUnavailable);
      setMode('copy');

      return;
    }

    try {
      const recipientKeyEntry: ConversationKeyEntry = {
        ...conversationKey,
        conversationId: conversation.id,
        peerIdentityId: session.identity.id,
      };
      const encrypted = PublicKey.fromPEM(
        peerIdentity.encryptedKeyPair.publicKey,
      )
        .encrypt(JSON.stringify(recipientKeyEntry))
        .toString();

      setEncryptedKey(encrypted);
      setError(null);
    } catch {
      setError(copy.chat.copyPrivateKeyError);
    }
    setMode('copy');
  }, [conversation, conversationKey, peerIdentity, session.identity.id]);

  const importKey = useCallback(async () => {
    if (!conversation) return;

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

      assertConversationKeyPackage(parsed, conversation.id);
      SymmetricKey.fromBase64(parsed.key);
      await onConversationKeyImported({
        algorithm: 'aes-256-gcm',
        conversationId: conversation.id,
        createdAt: parsed.createdAt ?? Date.now(),
        key: parsed.key,
        kind: parsed.kind ?? 'conversation',
        peerIdentityId:
          parsed.peerIdentityId ?? peerIdentityId ?? session.identity.id,
        version: 2,
      });
      close();
    } catch {
      setError(copy.chat.addPrivateKeyError);
    } finally {
      setSaving(false);
    }
  }, [
    close,
    conversation,
    input,
    onConversationKeyImported,
    peerIdentityId,
    session.identity.id,
    session.keyPair,
  ]);

  return {
    close,
    copy: () => navigator.clipboard.writeText(encryptedKey),
    encryptedKey,
    error,
    importKey,
    input,
    mode,
    openAdd,
    openCopy,
    saving,
    setInput,
  };
}
