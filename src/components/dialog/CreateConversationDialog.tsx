import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type {
  ConversationResource,
  IdentityResource,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { Field } from '../auth/Field';
import { GlassSelect } from '../common/GlassSelect';

type LoadState = 'idle' | 'loading' | 'error';
type IdentityLookupState = 'idle' | 'loading' | 'ready';

interface CreateConversationDialogProps {
  nodeNetworks: NodeNetwork[];
  session: Session;
  onClose: () => void;
  onCreated: (session: Session, conversation: ConversationResource) => void;
}

export function CreateConversationDialog({
  nodeNetworks,
  onClose,
  onCreated,
  session,
}: CreateConversationDialogProps) {
  const [peerIdentityId, setPeerIdentityId] = useState('');
  const [peerIdentity, setPeerIdentity] = useState<IdentityResource | null>(
    null,
  );
  const [lookupState, setLookupState] = useState<IdentityLookupState>('idle');
  const [selectedNetworkId, setSelectedNetworkId] = useState('');
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const sharedNetworkIds = useMemo(() => {
    if (!peerIdentity) return [];

    return session.identity.networks.filter((networkId) =>
      peerIdentity.networks.includes(networkId),
    );
  }, [peerIdentity, session.identity.networks]);
  const sharedNetworkOptions = sharedNetworkIds.map((networkId) => ({
    label:
      nodeNetworks.find((network) => network.id === networkId)?.name ??
      networkId,
    value: networkId,
  }));

  useEffect(() => {
    const trimmed = peerIdentityId.trim();

    setError(null);
    setPeerIdentity(null);
    setSelectedNetworkId('');

    if (!trimmed) {
      setLookupState('idle');
      return undefined;
    }

    let cancelled = false;

    setLookupState('loading');
    const timeout = window.setTimeout(() => {
      void pigeonApplication
        .getIdentity(trimmed)
        .then((identity) => {
          if (cancelled) return;

          const sharedNetworks = session.identity.networks.filter(
            (networkId) => identity.networks.includes(networkId),
          );

          setPeerIdentity(identity);
          setSelectedNetworkId(sharedNetworks[0] ?? '');
          setLookupState('ready');
        })
        .catch(() => {
          if (cancelled) return;

          setLookupState('idle');
        });
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [peerIdentityId, session.identity.networks]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!peerIdentityId.trim()) return;

    if (!selectedNetworkId) {
      setError(copy.dialog.noSharedNetwork);
      return;
    }

    setState('loading');
    setError(null);

    try {
      const result = await pigeonApplication.createConversation(
        session,
        peerIdentityId,
        selectedNetworkId,
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
        toUserErrorMessage(caught, copy.dialog.createConversationError),
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

        {lookupState === 'loading' && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-white/55">
            {copy.dialog.loadingIdentity}
          </div>
        )}

        {peerIdentity && sharedNetworkOptions.length > 0 && (
          <Field label={copy.dialog.sharedNetwork}>
            <GlassSelect
              ariaLabel={copy.dialog.sharedNetwork}
              value={selectedNetworkId}
              onChange={setSelectedNetworkId}
              options={sharedNetworkOptions}
            />
          </Field>
        )}

        {peerIdentity &&
          lookupState === 'ready' &&
          sharedNetworkOptions.length === 0 && (
            <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-500/15 p-3 text-sm text-amber-100">
              {copy.dialog.noSharedNetwork}
            </div>
          )}

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
            disabled={
              !peerIdentityId.trim() ||
              !selectedNetworkId ||
              state === 'loading'
            }
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
