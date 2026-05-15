import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Community, IdentityResource, Session } from '../../domain/types';

import { pigeonApplication } from '../../application/applicationContainer';
import { copy } from '../../i18n/en';
import { shortId } from '../../utils/formatting';
import { identityName } from '../../utils/identityDisplay';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { Field } from '../auth/Field';
import { DialogHeader } from './communityDialogPrimitives';
import { loadIdentityPicture } from './communityImages';

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
  const [error, setError] = useState<string | null>(null);
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'ready'>(
    'idle',
  );
  const [memberIdentity, setMemberIdentity] = useState<IdentityResource | null>(
    null,
  );
  const [memberPictureUrl, setMemberPictureUrl] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading'>('idle');

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

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 w-full rounded-none p-5 shadow-2xl shadow-black/40 sm:max-w-md sm:rounded-[2rem]">
        <DialogHeader title={copy.communities.addMember} onClose={onClose} />
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
        {error && (
          <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-3 text-xs text-rose-100">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => void addMember()}
          disabled={!memberIdentity || state === 'loading'}
          className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {copy.communities.addMember}
        </button>
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
  const name = identityName(identity) ?? shortId(identity.id);
  const handle = identity.profile.handle
    ? `@${identity.profile.handle}`
    : identity.id;

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
        <p className="truncate text-xs text-white/45">{handle}</p>
      </div>
    </div>
  );
}

function normalizeIdentityLookup(value: string): string {
  const trimmed = value.trim();

  return trimmed.startsWith('@') ? trimmed.slice(1).toLowerCase() : trimmed;
}
