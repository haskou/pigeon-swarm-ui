import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { NodeNetwork } from '../../application/networks/ListNodeNetworks';
import type {
  ConversationResource,
  IdentityResource,
  Session,
} from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { shortId } from '../../utils/formatting';
import {
  identityPicture,
  profilePictureDataUrl,
} from '../../utils/identityDisplay';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { Field } from '../auth/Field';
import { GlassSelect } from '../common/GlassSelect';

type LoadState = 'idle' | 'loading' | 'error';
type IdentityLookupState = 'idle' | 'loading' | 'ready';
type ConversationMode = 'direct' | 'group';
type SelectedIdentity = {
  identity: IdentityResource;
  pictureUrl: null | string;
};

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
  const [mode, setMode] = useState<ConversationMode>('direct');
  const [peerIdentityId, setPeerIdentityId] = useState('');
  const [peerIdentity, setPeerIdentity] = useState<IdentityResource | null>(
    null,
  );
  const [lookupState, setLookupState] = useState<IdentityLookupState>('idle');
  const [peerPictureUrl, setPeerPictureUrl] = useState<string | null>(null);
  const [selectedNetworkId, setSelectedNetworkId] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupIdentityInput, setGroupIdentityInput] = useState('');
  const [groupIdentityLookupState, setGroupIdentityLookupState] =
    useState<IdentityLookupState>('idle');
  const [groupIdentityPreview, setGroupIdentityPreview] =
    useState<SelectedIdentity | null>(null);
  const [groupParticipants, setGroupParticipants] = useState<
    SelectedIdentity[]
  >([]);
  const [groupNetworkId, setGroupNetworkId] = useState('');
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const sharedNetworkIds = useMemo(() => {
    if (!peerIdentity) return [];

    return session.identity.networks.filter((networkId) =>
      peerIdentity.networks.includes(networkId),
    );
  }, [peerIdentity, session.identity.networks]);
  const groupSharedNetworkIds = useMemo(() => {
    if (groupParticipants.length === 0) return [];

    return session.identity.networks.filter((networkId) =>
      groupParticipants.every(({ identity }) =>
        identity.networks.includes(networkId),
      ),
    );
  }, [groupParticipants, session.identity.networks]);
  const networkOptions = session.identity.networks.map((networkId) => ({
    disabled: peerIdentity ? !sharedNetworkIds.includes(networkId) : true,
    label:
      nodeNetworks.find((network) => network.id === networkId)?.name ??
      networkId,
    value: networkId,
  }));
  const groupNetworkOptions = session.identity.networks.map((networkId) => ({
    disabled:
      groupParticipants.length === 0 ||
      !groupSharedNetworkIds.includes(networkId),
    label:
      nodeNetworks.find((network) => network.id === networkId)?.name ??
      networkId,
    value: networkId,
  }));
  const peerDisplayName = peerIdentity
    ? identityPrimaryName(peerIdentity)
    : null;
  const canSubmitDirect =
    !!peerIdentity && !!selectedNetworkId && state !== 'loading';
  const canSubmitGroup =
    groupName.trim().length > 0 &&
    groupParticipants.length > 0 &&
    !!groupNetworkId &&
    state !== 'loading';

  useEffect(() => {
    const trimmed = normalizeIdentityLookup(peerIdentityId);

    setError(null);
    setPeerIdentity(null);
    setPeerPictureUrl(null);
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

          const sharedNetworks = session.identity.networks.filter((networkId) =>
            identity.networks.includes(networkId),
          );

          setPeerIdentity(identity);
          setSelectedNetworkId(sharedNetworks[0] ?? '');
          setLookupState('ready');

          void loadDialogIdentityPicture(identity).then((picture) => {
            if (!cancelled) setPeerPictureUrl(picture);
          });
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

  useEffect(() => {
    const identityLookup = normalizeIdentityLookup(groupIdentityInput);

    setError(null);
    setGroupIdentityPreview(null);

    if (!identityLookup) {
      setGroupIdentityLookupState('idle');

      return undefined;
    }

    let cancelled = false;

    setGroupIdentityLookupState('loading');
    const timeout = window.setTimeout(() => {
      void pigeonApplication
        .getIdentity(identityLookup)
        .then((identity) => {
          if (cancelled) return;

          setGroupIdentityLookupState('ready');
          setGroupIdentityPreview({ identity, pictureUrl: null });
          void loadDialogIdentityPicture(identity).then((pictureUrl) => {
            if (!cancelled) {
              setGroupIdentityPreview({ identity, pictureUrl });
            }
          });
        })
        .catch(() => {
          if (!cancelled) setGroupIdentityLookupState('idle');
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [groupIdentityInput]);

  useEffect(() => {
    if (groupNetworkId && groupSharedNetworkIds.includes(groupNetworkId)) {
      return;
    }

    setGroupNetworkId(groupSharedNetworkIds[0] ?? '');
  }, [groupNetworkId, groupSharedNetworkIds]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (mode === 'group') {
      if (!canSubmitGroup) return;

      setState('loading');
      setError(null);

      try {
        const result = await pigeonApplication.createGroupConversation(
          session,
          {
            name: groupName.trim(),
            networkId: groupNetworkId,
            participantIds: groupParticipants.map(({ identity }) => identity.id),
          },
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
      return;
    }

    const identityLookup = normalizeIdentityLookup(peerIdentityId);

    if (!identityLookup) return;

    if (!selectedNetworkId) {
      setError(copy.dialog.noSharedNetwork);

      return;
    }

    setState('loading');
    setError(null);

    try {
      const result = await pigeonApplication.createConversation(
        session,
        identityLookup,
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
      setError(toUserErrorMessage(caught, copy.dialog.createConversationError));

      return;
    }

    setState('idle');
  };

  const addGroupParticipant = async () => {
    const identity = groupIdentityPreview?.identity;

    if (!identity) return;

    if (
      identity.id === session.identity.id ||
      groupParticipants.some(
        (participant) => participant.identity.id === identity.id,
      )
    ) {
      setGroupIdentityInput('');

      return;
    }

    setState('loading');
    setError(null);
    try {
      const alreadyAdded = groupParticipants.some(
        (participant) => participant.identity.id === identity.id,
      );

      if (!alreadyAdded) {
        setGroupParticipants((participants) => [
          ...participants,
          groupIdentityPreview,
        ]);
      }
      setGroupIdentityInput('');
      setGroupIdentityPreview(null);
      setGroupIdentityLookupState('idle');
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.errors.notFound));
    }
    setState('idle');
  };

  const removeGroupParticipant = (identityId: string) => {
    setGroupParticipants((participants) =>
      participants.filter(({ identity }) => identity.id !== identityId),
    );
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

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-black/25 p-1">
          <button
            type="button"
            onClick={() => {
              setMode('direct');
              setError(null);
            }}
            className={
              mode === 'direct'
                ? 'rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-950'
                : 'rounded-xl px-3 py-2 text-sm font-black text-white/60 transition hover:bg-white/10'
            }
          >
            {copy.dialog.directConversation}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('group');
              setError(null);
            }}
            className={
              mode === 'group'
                ? 'rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-950'
                : 'rounded-xl px-3 py-2 text-sm font-black text-white/60 transition hover:bg-white/10'
            }
          >
            {copy.dialog.groupConversation}
          </button>
        </div>

        {mode === 'direct' ? (
          <>
            <div className="mt-2">
              <Field label={copy.dialog.remoteIdentityId}>
                <input
                  value={peerIdentityId}
                  onChange={(event) => setPeerIdentityId(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  placeholder="@ada or MCowBQYDK2VwAyEAWtRH3+ilAHq/szBVS7kQX4CsbE1EOWNu8RDyC9Bax9A="
                  autoComplete="off"
                />
              </Field>
            </div>
            {lookupState === 'loading' && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-white/55">
                {copy.dialog.loadingIdentity}
              </div>
            )}

            {peerIdentity && peerDisplayName && (
              <IdentityPreview
                identity={peerIdentity}
                name={peerDisplayName}
                pictureUrl={peerPictureUrl}
              />
            )}
            {peerIdentity &&
              lookupState === 'ready' &&
              sharedNetworkIds.length === 0 && (
                <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-500/15 p-3 text-sm text-amber-100">
                  {copy.dialog.noSharedNetwork}
                </div>
              )}
            <div className="mt-2">
              <Field label={copy.dialog.sharedNetwork}>
                <GlassSelect
                  ariaLabel={copy.dialog.sharedNetwork}
                  disabled={!peerIdentity || sharedNetworkIds.length === 0}
                  value={selectedNetworkId}
                  onChange={setSelectedNetworkId}
                  options={networkOptions}
                />
              </Field>{' '}
            </div>
          </>
        ) : (
          <div className="mt-4 grid gap-3">
            <Field label={copy.dialog.groupName}>
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                placeholder={copy.dialog.groupNamePlaceholder}
                autoComplete="off"
              />
            </Field>

            <Field label={copy.dialog.groupParticipant}>
              <div className="flex gap-2">
                <input
                  value={groupIdentityInput}
                  onChange={(event) =>
                    setGroupIdentityInput(event.target.value)
                  }
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void addGroupParticipant();
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  placeholder="@ada or identity id"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => void addGroupParticipant()}
                  disabled={!groupIdentityInput.trim() || state === 'loading'}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {copy.dialog.addParticipant}
                </button>
              </div>
            </Field>
            {groupIdentityLookupState === 'loading' && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-white/55">
                {copy.dialog.loadingIdentity}
              </div>
            )}
            {groupIdentityPreview && (
              <IdentityPreview
                identity={groupIdentityPreview.identity}
                name={identityPrimaryName(groupIdentityPreview.identity)}
                pictureUrl={groupIdentityPreview.pictureUrl}
              />
            )}

            <div className="grid gap-2">
              <div className="text-sm font-black text-white/70">
                {copy.dialog.groupParticipants}
              </div>
              {groupParticipants.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/45">
                  {copy.dialog.groupNeedsParticipant}
                </div>
              ) : (
                <div className="grid gap-2">
                  {groupParticipants.map(({ identity, pictureUrl }) => {
                    const name = identityPrimaryName(identity);

                    return (
                      <div
                        key={identity.id}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        <Avatar name={name} pictureUrl={pictureUrl} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-black">{name}</p>
                          <p className="truncate text-xs text-white/45">
                            {identitySecondaryName(identity)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeGroupParticipant(identity.id)}
                          className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-lg font-black text-white/70 transition hover:bg-white/15"
                          aria-label={copy.dialog.removeParticipant}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {groupParticipants.length > 0 &&
              groupSharedNetworkIds.length === 0 && (
                <div className="rounded-2xl border border-amber-300/25 bg-amber-500/15 p-3 text-sm text-amber-100">
                  {copy.dialog.noSharedNetwork}
                </div>
              )}

            <Field label={copy.dialog.sharedNetwork}>
              <GlassSelect
                ariaLabel={copy.dialog.sharedNetwork}
                disabled={
                  groupParticipants.length === 0 ||
                  groupSharedNetworkIds.length === 0
                }
                value={groupNetworkId}
                onChange={setGroupNetworkId}
                options={groupNetworkOptions}
              />
            </Field>
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
            disabled={mode === 'direct' ? !canSubmitDirect : !canSubmitGroup}
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

function IdentityPreview({
  identity,
  name,
  pictureUrl,
}: {
  identity: IdentityResource;
  name: string;
  pictureUrl: null | string;
}) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <Avatar name={name} pictureUrl={pictureUrl} />
      <div className="min-w-0">
        <p className="truncate font-black">{name}</p>
        <p className="truncate text-xs text-white/45">
          {identitySecondaryName(identity)}
        </p>
      </div>
    </div>
  );
}

function identityPrimaryName(identity: IdentityResource): string {
  return identity.profile.name.trim() || shortId(identity.id);
}

function identitySecondaryName(identity: IdentityResource): string {
  const handle = identity.profile.handle?.trim();

  return handle ? `@${handle}` : identity.id;
}

function Avatar({
  name,
  pictureUrl,
}: {
  name: string;
  pictureUrl: null | string;
}) {
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
      {pictureUrl ? (
        <img src={pictureUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

function normalizeIdentityLookup(value: string): string {
  const trimmed = value.trim();

  return trimmed.startsWith('@') ? trimmed.slice(1).toLowerCase() : trimmed;
}

async function loadDialogIdentityPicture(
  identity: IdentityResource,
): Promise<string | null> {
  const directPicture = identityPicture(identity);

  if (directPicture) return directPicture;

  const pictureCid = identity.profile.picture?.trim();

  if (!pictureCid) return null;

  try {
    const content = await pigeonApplication.getPublicFile(pictureCid);

    return profilePictureDataUrl(content);
  } catch {
    return null;
  }
}
