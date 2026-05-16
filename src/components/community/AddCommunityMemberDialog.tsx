import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Community, IdentityResource, Session } from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { shortId } from '../../utils/formatting';
import { createCommunityInviteUrl } from '../../utils/communityInviteLink';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { Field } from '../auth/Field';
import { SegmentedControl } from '../common/SegmentedControl';
import { DialogHeader } from './communityDialogPrimitives';
import { loadIdentityPicture } from './communityImages';

type AddMemberMode = 'identity' | 'link';

type AddCommunityMemberDialogProps = {
  communityId: string;
  onClose: () => void;
  onCommunityUpdated: (community: Community) => void;
  onSessionUpdated: (session: Session) => void;
  session: Session;
};

export function AddCommunityMemberDialog({
  communityId,
  onClose,
  onCommunityUpdated,
  onSessionUpdated,
  session,
}: AddCommunityMemberDialogProps) {
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
    { label: 'Find identity', value: 'identity' },
    { label: 'Create invite link', value: 'link' },
  ] satisfies Array<{ label: string; value: AddMemberMode }>;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
      void pigeonApplication
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
      const result = await pigeonApplication.createCommunityInvitation(
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

      onCommunityUpdated(
        await pigeonApplication.getCommunity(session, communityId),
      );
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
      const result = await pigeonApplication.createCommunityInviteLink(
        session,
        communityId,
      );
      const token = result.invite.inviteToken ?? result.invite.token;

      if (!token) throw new Error(copy.communities.linkError);

      const link = createCommunityInviteUrl({
        keyEntry: result.keyEntry,
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
    <div className="fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 w-full rounded-none p-5 shadow-2xl shadow-black/40 sm:max-w-md sm:rounded-2xl">
        <DialogHeader title={copy.communities.addMember} onClose={onClose} />
        <SegmentedControl
          className="mt-5"
          onChange={setMode}
          options={modeOptions}
          value={mode}
        />
        {mode === 'identity' ? (
          <>
            <div className="mt-4">
              <Field label={copy.communities.memberIdentity}>
                <input
                  autoFocus
                  value={identityInput}
                  onChange={(event) => setIdentityInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    void addMember();
                  }}
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                  placeholder="@ada or identity id"
                />
              </Field>
            </div>
            {lookupState === 'loading' && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-white/55">
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
              className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copy.communities.addMember}
            </button>
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="text-xs leading-5 text-white/55">
              {copy.communities.linkHelp}
            </div>
            {inviteLink && (
              <input
                readOnly
                value={inviteLink}
                className="mt-3 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/70 outline-none"
                onFocus={(event) => event.target.select()}
              />
            )}
            <button
              type="button"
              onClick={() => void createInviteLink()}
              disabled={linkState === 'loading'}
              className="mt-3 w-full rounded-2xl bg-fuchsia-500 px-4 py-3 text-sm font-black text-white transition hover:bg-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-45"
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
          <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
            {error}
          </div>
        )}
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
    <div className="mt-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-300 to-fuchsia-400 font-black text-slate-950">
        {pictureUrl ? (
          <img src={pictureUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
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
