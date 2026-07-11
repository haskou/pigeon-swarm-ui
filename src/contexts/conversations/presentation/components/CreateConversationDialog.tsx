import { FormEvent, useEffect, useMemo, useState } from 'react';

import type { NodeNetwork } from '../../../networks/application/list-node-networks/ListNodeNetworks';
import type {
  ConversationResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { Field } from '../../../identities/presentation/auth/Field';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { shortId } from '../../../../shared/presentation/formatting';
import {
  identityPicture,
  publicFileObjectUrl,
} from '../../../identities/presentation/view-models/identityDisplay';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { GlassSelect } from '../../../../shared/presentation/components/glassSelect';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import { IdentityMemberRow } from '../../../identities/presentation/components/IdentityMemberListPanel';
import { ConversationPeer } from '../../domain/ConversationPeer';

type LoadState = 'idle' | 'loading' | 'error';
type IdentityLookupState =
  | 'idle'
  | 'invalid'
  | 'loading'
  | 'not_found'
  | 'ready';
type ConversationMode = 'direct' | 'group';
type SelectedIdentity = {
  identity: IdentityResource;
  pictureUrl: null | string;
};

interface CreateConversationDialogProps {
  conversations: ConversationResource[];
  nodeNetworks: NodeNetwork[];
  session: Session;
  onClose: () => void;
  onCreated: (session: Session, conversation: ConversationResource) => void;
}

export function CreateConversationDialog({
  conversations,
  nodeNetworks,
  onClose,
  onCreated,
  session,
}: CreateConversationDialogProps) {
  const { close, state: transitionState } = useCloseTransition(onClose);

  useCloseOnEscape(close);

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
  const existingDirectConversation = useMemo(() => {
    if (!peerIdentity) return undefined;

    return conversations.find(
      (conversation) =>
        ConversationPeer.identityId(
          conversation,
          session.identity.id,
          session.keychain,
        ) === peerIdentity.id,
    );
  }, [conversations, peerIdentity, session.identity.id, session.keychain]);
  const canSubmitDirect =
    !!peerIdentity &&
    !!selectedNetworkId &&
    !existingDirectConversation &&
    state !== 'loading';
  const canSubmitGroup =
    groupName.trim().length > 0 &&
    groupParticipants.length > 0 &&
    !!groupNetworkId &&
    state !== 'loading';
  const remoteIdentityStatus = remoteIdentityLookupStatus({
    input: peerIdentityId,
    lookupState,
    peerIdentity,
  });

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

    if (!identityLookupIsValid(peerIdentityId)) {
      setLookupState('invalid');

      return undefined;
    }

    let cancelled = false;

    setLookupState('loading');
    const timeout = window.setTimeout(() => {
      void applicationContainer
        .identities.get(trimmed)
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

          setLookupState('not_found');
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
      void applicationContainer
        .identities.get(identityLookup)
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (mode === 'group') {
      if (!canSubmitGroup) return;

      setState('loading');
      setError(null);

      try {
        const result = await applicationContainer.createGroupConversation(
          session,
          {
            name: groupName.trim(),
            networkId: groupNetworkId,
            participantIds: groupParticipants.map(
              ({ identity }) => identity.id,
            ),
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

    if (!peerIdentity) return;

    if (existingDirectConversation) {
      setError(copy.dialog.directConversationAlreadyExists);

      return;
    }

    if (!selectedNetworkId) {
      setError(copy.dialog.noSharedNetwork);

      return;
    }

    if (!canSubmitDirect) return;

    setState('loading');
    setError(null);

    try {
      const result = await applicationContainer.createConversation(
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

  const addGroupParticipant = () => {
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
    <div
      className="app-overlay-scrim fixed inset-0 z-50 grid place-items-stretch bg-black/60 p-0 backdrop-blur-sm sm:place-items-center sm:p-4"
      data-state={transitionState}
    >
      <form
        onSubmit={handleSubmit}
        className="app-overlay-surface app-safe-area-panel ui-dialog-surface flex h-[100dvh] w-full flex-col overflow-hidden sm:h-auto sm:max-h-[88vh] sm:min-h-[32rem] sm:max-w-2xl"
        data-state={transitionState}
      >
        <DialogHeader
          description={copy.dialog.createConversationBody}
          title={copy.dialog.createConversationTitle}
          onClose={close}
        />

        <div className="min-h-0 overflow-y-auto px-5 pb-5">
          <SegmentedControl
            className="mt-5"
            value={mode}
            onChange={(nextMode) => {
              setMode(nextMode);
              setError(null);
            }}
            options={[
              { label: copy.dialog.directConversation, value: 'direct' },
              { label: copy.dialog.groupConversation, value: 'group' },
            ]}
          />

          {mode === 'direct' ? (
            <div className="mt-4 grid min-h-[18rem] content-start gap-5 sm:grid-cols-[minmax(0,1fr)_17rem]">
              <div className="grid content-start gap-4">
                <Field label={copy.identityLookup.label}>
                  <input
                    value={peerIdentityId}
                    onChange={(event) => setPeerIdentityId(event.target.value)}
                    className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
                    placeholder={copy.identityLookup.placeholder}
                    autoComplete="off"
                    data-testid="create-conversation-recipient-input"
                  />
                  <IdentityLookupStatus status={remoteIdentityStatus} />
                </Field>
                <Field label={copy.dialog.sharedNetwork}>
                  <GlassSelect
                    ariaLabel={copy.dialog.selectSwarm}
                    disabled={!peerIdentity || sharedNetworkIds.length === 0}
                    value={selectedNetworkId}
                    onChange={setSelectedNetworkId}
                    data-testid="create-conversation-network-select"
                    options={networkOptions}
                  />
                </Field>
                {existingDirectConversation ? (
                  <div className="border-l-2 border-amber-300/50 pl-3 text-sm text-amber-100">
                    {copy.dialog.directConversationAlreadyExists}
                  </div>
                ) : null}
                {peerIdentity &&
                lookupState === 'ready' &&
                sharedNetworkIds.length === 0 ? (
                  <div className="border-l-2 border-amber-300/50 pl-3 text-sm text-amber-100">
                    {copy.dialog.noSharedNetwork}
                  </div>
                ) : null}
              </div>
              <div className="border-y border-white/10 py-3 sm:border-y-0 sm:border-l sm:py-0 sm:pl-5">
                <div className="ui-section-heading pt-0">
                  {copy.communities.memberPreview}
                </div>
                {peerIdentity && peerDisplayName ? (
                  <IdentityMemberRow
                    interactive={false}
                    item={{
                      identity: peerIdentity,
                      identityId: peerIdentity.id,
                      pictureUrl: peerPictureUrl,
                    }}
                  />
                ) : (
                  <p className="py-4 text-sm leading-6 text-white/40">
                    {copy.communities.memberPreviewEmpty}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              <Field label={copy.dialog.groupName}>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
                  placeholder={copy.dialog.groupNamePlaceholder}
                  autoComplete="off"
                />
              </Field>

              <Field label={copy.identityLookup.label}>
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
                    className="ui-field-control min-w-0 flex-1 px-4 py-3 text-sm placeholder:text-white/30"
                    placeholder={copy.identityLookup.placeholder}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => void addGroupParticipant()}
                    disabled={!groupIdentityInput.trim() || state === 'loading'}
                    className="ui-button"
                  >
                    {copy.dialog.addParticipant}
                  </button>
                </div>
              </Field>
              {groupIdentityLookupState === 'loading' && (
                <div className="ui-inline-notice text-sm font-bold text-white/55">
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
                  <div className="ui-inline-notice text-sm text-white/45">
                    {copy.dialog.groupNeedsParticipant}
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {groupParticipants.map(({ identity, pictureUrl }) => {
                      const name = identityPrimaryName(identity);

                      return (
                        <div key={identity.id} className="ui-list-row">
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
                            className="ui-icon-button h-9 w-9 text-lg"
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
                  <div className="ui-inline-notice border-amber-300/25 bg-amber-500/10 text-sm text-amber-100">
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
            <div className="ui-inline-notice mt-4 border-rose-300/50 bg-rose-500/10 text-rose-100">
              {error}
            </div>
          )}

          <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="ui-button">
              {copy.dialog.cancel}
            </button>
            <button
              disabled={mode === 'direct' ? !canSubmitDirect : !canSubmitGroup}
              className="ui-button ui-button-primary"
              data-testid="create-conversation-submit-button"
            >
              {state === 'loading'
                ? copy.dialog.createConversationLoading
                : copy.dialog.createConversation}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

type IdentityLookupStatusModel = {
  label: string;
  tone: 'danger' | 'info' | 'muted' | 'success';
};

function IdentityLookupStatus({
  status,
}: {
  status: IdentityLookupStatusModel;
}) {
  const color =
    status.tone === 'danger'
      ? 'text-rose-200'
      : status.tone === 'info'
        ? 'text-cyan-100'
        : status.tone === 'success'
          ? 'text-emerald-200'
          : 'text-white/45';

  return (
    <span className={`mt-2 block text-xs font-bold ${color}`}>
      {status.label}
    </span>
  );
}

function remoteIdentityLookupStatus(input: {
  input: string;
  lookupState: IdentityLookupState;
  peerIdentity: IdentityResource | null;
}): IdentityLookupStatusModel {
  if (!input.input.trim()) {
    return {
      label: copy.identityLookup.help,
      tone: 'muted',
    };
  }

  if (input.lookupState === 'invalid') {
    return {
      label: copy.dialog.remoteIdentityInvalid,
      tone: 'danger',
    };
  }

  if (input.lookupState === 'loading') {
    return {
      label: copy.dialog.loadingIdentity,
      tone: 'info',
    };
  }

  if (input.lookupState === 'not_found') {
    return {
      label: copy.dialog.remoteIdentityNotFound,
      tone: 'danger',
    };
  }

  if (input.lookupState === 'ready' && input.peerIdentity) {
    return {
      label: input.input.trim().startsWith('@')
        ? copy.dialog.remoteIdentityFound
        : copy.dialog.remoteIdentityValid,
      tone: 'success',
    };
  }

  return {
    label: copy.identityLookup.help,
    tone: 'muted',
  };
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
      <FallbackImage
        src={pictureUrl}
        alt=""
        className="h-full w-full object-cover"
        fallback={name.slice(0, 1).toUpperCase()}
      />
    </div>
  );
}

function normalizeIdentityLookup(value: string): string {
  const trimmed = value.trim();

  return trimmed.startsWith('@') ? trimmed.slice(1).toLowerCase() : trimmed;
}

function identityLookupIsValid(value: string): boolean {
  const trimmed = value.trim();

  if (!trimmed || trimmed === '@') return false;

  return !/\s/.test(trimmed);
}

async function loadDialogIdentityPicture(
  identity: IdentityResource,
): Promise<string | null> {
  const directPicture = identityPicture(identity);

  if (directPicture) return directPicture;

  const pictureCid = identity.profile.picture?.trim();

  if (!pictureCid) return null;

  try {
    const content = await applicationContainer.attachments.getPublicFile(
      pictureCid,
    );

    return publicFileObjectUrl(content);
  } catch {
    return null;
  }
}
