import { FormEvent, useState } from 'react';

import type { ConversationResource, Session } from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { Field } from '../auth/Field';

type LoadState = 'idle' | 'loading' | 'error';

interface CreateConversationDialogProps {
  session: Session;
  onClose: () => void;
  onCreated: (session: Session, conversation: ConversationResource) => void;
}

export function CreateConversationDialog({
  onClose,
  onCreated,
  session,
}: CreateConversationDialogProps) {
  const [peerIdentityId, setPeerIdentityId] = useState('');
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!peerIdentityId.trim()) return;

    setState('loading');
    setError(null);

    try {
      const result = await pigeonApplication.createConversation(
        session,
        peerIdentityId,
      );
      onCreated(
        {
          ...session,
          keychain: result.keychain,
          keychainExternalIdentifier: result.keychainExternalIdentifier,
        },
        result.conversation,
      );
    } catch (caught) {
      setState('error');
      setError(
        caught instanceof Error
          ? caught.message
          : copy.dialog.createConversationError,
      );

      return;
    }

    setState('idle');
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-stretch bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="glass-panel-strong flex min-h-screen w-full flex-col justify-center rounded-none p-5 sm:min-h-0 sm:max-w-xl sm:rounded-[2rem] sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight">
              {copy.dialog.createConversationTitle}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              {copy.dialog.createConversationBody}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.dialog.close}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 font-black"
          >
            ×
          </button>
        </div>

        <Field label={copy.dialog.remoteIdentityId}>
          <textarea
            value={peerIdentityId}
            onChange={(event) => setPeerIdentityId(event.target.value)}
            className="min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
            placeholder="MCowBQYDK2VwAyEAWtRH3+ilAHq/szBVS7kQX4CsbE1EOWNu8RDyC9Bax9A="
          />
        </Field>

        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white/70"
          >
            {copy.dialog.cancel}
          </button>
          <button
            disabled={!peerIdentityId.trim() || state === 'loading'}
            className="glass-button rounded-2xl bg-fuchsia-500 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {state === 'loading'
              ? copy.dialog.createConversationLoading
              : copy.dialog.createConversation}
          </button>
        </div>
      </form>
    </div>
  );
}
