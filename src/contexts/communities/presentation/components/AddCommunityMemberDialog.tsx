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
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { IdentityMemberRow } from '../../../identities/presentation/components/IdentityMemberListPanel';
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
      <section className="app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden sm:h-auto sm:min-h-[26rem] sm:max-h-[84vh] sm:max-w-2xl">
        <DialogHeader
          description={copy.communities.addMemberDescription}
          title={copy.communities.addMember}
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <SegmentedControl
            className="mt-5"
            onChange={setMode}
            options={modeOptions}
            value={mode}
          />
          {mode === 'identity' ? (
            <div className="mt-4 grid min-h-[18rem] content-start gap-5 sm:grid-cols-[minmax(0,1fr)_17rem]">
              <div>
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
                <p className="mt-2 text-xs leading-5 text-white/45">
                  {copy.identityLookup.help}
                </p>
                {lookupState === 'loading' && (
                  <div className="mt-4 flex items-center gap-2 border-y border-white/10 py-3 text-sm font-bold text-white/55">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                    {copy.dialog.loadingIdentity}
                  </div>
                )}
              </div>
              <div className="border-y border-white/10 py-3 sm:border-y-0 sm:border-l sm:py-0 sm:pl-5">
                <div className="ui-section-heading pt-0">
                  {copy.communities.memberPreview}
                </div>
                {memberIdentity && lookupState === 'ready' ? (
                  <IdentityMemberRow
                    interactive={false}
                    item={{
                      identity: memberIdentity,
                      identityId: memberIdentity.id,
                      pictureUrl: memberPictureUrl,
                    }}
                  />
                ) : (
                  <p className="py-4 text-sm leading-6 text-white/40">
                    {copy.communities.memberPreviewEmpty}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void addMember()}
                  disabled={!memberIdentity || state === 'loading'}
                  className="ui-button ui-button-primary mt-4 w-full"
                >
                  {copy.communities.addMember}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 grid min-h-[18rem] content-start gap-4 border-y border-white/10 py-5">
              <div className="max-w-xl text-sm leading-6 text-white/55">
                {copy.communities.linkHelp}
              </div>
              {inviteLink && (
                <input
                  readOnly
                  value={inviteLink}
                  className="ui-field-control px-3 py-2 text-xs text-white/70"
                  onFocus={(event) => event.target.select()}
                />
              )}
              <button
                type="button"
                onClick={() => void createInviteLink()}
                disabled={linkState === 'loading'}
                className="ui-button ui-button-primary justify-self-start"
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

function normalizeIdentityLookup(value: string): string {
  const trimmed = value.trim();

  return trimmed.startsWith('@') ? trimmed.slice(1).toLowerCase() : trimmed;
}
