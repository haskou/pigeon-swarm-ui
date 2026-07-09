import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type {
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { Field } from '../../../identities/presentation/auth/Field';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { createCommunityInviteUrl } from '../view-models/communityInviteLink';
import { shortId } from '../../../../shared/presentation/formatting';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { FallbackImage } from '../../../../shared/presentation/components/FallbackImage';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { DialogHeader } from './communityDialogPrimitives';
import { loadIdentityPicture } from './communityImages';

type AddMemberMode = 'identity' | 'link';

type AddCommunityMemberDialogProps = {
  communityId: string;
  onClose: () => void;
  onSessionUpdated: (session: Session) => void;
  session: Session;
};

export function AddCommunityMemberDialog({
  communityId,
  onClose,
  onSessionUpdated,
  session,
}: AddCommunityMemberDialogProps) {
  useCloseOnEscape(onClose);

  const [identityInput, setIdentityInput] = useState('');
  const [mode, setMode] = useState<AddMemberMode>('identity');
  const [error, setError] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'ready'>(
    'idle',
  );
  const [memberIdentity, setMemberIdentity] = useState<IdentityResource | null>(
    null,
  );
  const [memberPictureUrl, setMemberPictureUrl] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');
  const [linkState, setLinkState] = useState<'copied' | 'idle' | 'loading'>(
    'idle',
  );
  const [inviteLink, setInviteLink] = useState('');
  const modeOptions = [
    { label: copy.communities.addMemberFindIdentity, value: 'identity' },
    { label: copy.communities.addMemberCreateInviteLink, value: 'link' },
  ] satisfies Array<{ label: string; value: AddMemberMode }>;

  useEffect(() => {
    const identityId = normalizeIdentityLookup(identityInput);

    setError(null);
    setMemberIdentity(null);
    setMemberPictureUrl(null);

    if (!identityId) {
      setLookupState('idle');

      return undefined;
    }

    let cancelled = false;

    setLookupState('loading');
    const timeout = window.setTimeout(() => {
      void applicationContainer
        .getIdentity(identityId)
        .then((identity) => {
          if (cancelled) return;

          setMemberIdentity(identity);
          setLookupState('ready');

          void loadIdentityPicture(identity).then((picture) => {
            if (!cancelled) setMemberPictureUrl(picture);
          });
        })
        .catch(() => {
          if (cancelled) return;
          setLookupState('idle');
        });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [identityInput]);

  const addMember = async () => {
    const identityId = memberIdentity?.id;

    if (!identityId || state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      const result = await applicationContainer.createCommunityInvitation(
        session,
        communityId,
        identityId,
      );

      if (
        result.keychain !== session.keychain ||
        result.keychainExternalIdentifier !== session.keychainExternalIdentifier
      ) {
        onSessionUpdated({
          ...session,
          keychain: result.keychain,
          keychainExternalIdentifier: result.keychainExternalIdentifier,
        });
      }

      onClose();
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.memberError));
    }

    setState('idle');
  };

  const createInviteLink = async () => {
    if (linkState === 'loading') return;

    setLinkState('loading');
    setError(null);
    try {
      const result = await applicationContainer.createCommunityInviteLink(
        session,
        communityId,
      );
      const token = result.invite.inviteToken ?? result.invite.token;

      if (!token) throw new Error(copy.communities.linkError);

      const link = createCommunityInviteUrl({
        inviteSecret: result.inviteSecret,
        token,
      });

      if (
        result.keychain !== session.keychain ||
        result.keychainExternalIdentifier !== session.keychainExternalIdentifier
      ) {
        onSessionUpdated({
          ...session,
          keychain: result.keychain,
          keychainExternalIdentifier: result.keychainExternalIdentifier,
        });
      }

      setInviteLink(link);

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        setLinkState('copied');
      } else {
        setLinkState('idle');
      }
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.linkError));
      setLinkState('idle');
    }
  };

  return createPortal(
    <div className="app-overlay-scrim fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden sm:h-auto sm:max-h-[84vh] sm:max-w-md">
        <DialogHeader title={copy.communities.addMember} onClose={onClose} />
        <div className="min-h-0 overflow-y-auto px-5 pb-5">
          <SegmentedControl
            className="mt-5"
            onChange={setMode}
            options={modeOptions}
            value={mode}
          />
          {mode === 'identity' ? (
            <>
              <div className="mt-4">
                <Field label={copy.identityLookup.label}>
                  <input
                    autoFocus
                    value={identityInput}
                    onChange={(event) => setIdentityInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      void addMember();
                    }}
                    className="ui-field-control px-3 py-2 text-sm placeholder:text-white/30"
                    placeholder={copy.identityLookup.placeholder}
                  />
                </Field>
              </div>
              {lookupState === 'loading' && (
                <div className="ui-inline-notice mt-3 text-sm font-bold text-white/55">
                  {copy.dialog.loadingIdentity}
                </div>
              )}
              {memberIdentity && lookupState === 'ready' && (
                <IdentityPreviewCard
                  identity={memberIdentity}
                  pictureUrl={memberPictureUrl}
                />
              )}
              <button
                type="button"
                onClick={() => void addMember()}
                disabled={!memberIdentity || state === 'loading'}
                className="ui-button ui-button-primary mt-4 w-full"
              >
                {copy.communities.addMember}
              </button>
            </>
          ) : (
            <div className="ui-section mt-4 py-3">
              <div className="text-xs leading-5 text-white/55">
                {copy.communities.linkHelp}
              </div>
              {inviteLink && (
                <input
                  readOnly
                  value={inviteLink}
                  className="ui-field-control mt-3 px-3 py-2 text-xs text-white/70"
                  onFocus={(event) => event.target.select()}
                />
              )}
              <button
                type="button"
                onClick={() => void createInviteLink()}
                disabled={linkState === 'loading'}
                className="ui-button ui-button-primary mt-3 w-full"
              >
                {linkState === 'loading'
                  ? copy.profile.saving
                  : linkState === 'copied'
                    ? copy.communities.linkCopied
                    : copy.communities.linkInvite}
              </button>
            </div>
          )}
          {error && (
            <div className="ui-inline-notice mt-4 border-rose-300/25 bg-rose-500/10 text-xs text-rose-100">
              {error}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function IdentityPreviewCard({
  identity,
  pictureUrl,
}: {
  identity: IdentityResource;
  pictureUrl: null | string;
}) {
  const name = identity.profile.name.trim() || shortId(identity.id);
  const handle = identity.profile.handle?.trim();

  return (
    <div className="ui-list-row mt-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
        <FallbackImage
          src={pictureUrl}
          alt=""
          className="h-full w-full object-cover"
          fallback={name.slice(0, 1).toUpperCase()}
        />
      </div>
      <div className="min-w-0">
        <p className="truncate font-black">{name}</p>
        <p className="truncate text-xs text-white/45">
          {handle ? `@${handle}` : identity.id}
        </p>
      </div>
    </div>
  );
}

function normalizeIdentityLookup(value: string): string {
  const trimmed = value.trim();

  return trimmed.startsWith('@') ? trimmed.slice(1).toLowerCase() : trimmed;
}
