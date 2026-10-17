import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import type { IdentityResource } from '../../../identities/infrastructure/http/resources/IdentityResource';
import type { Session } from '../../../identities/infrastructure/session/Session';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { Field } from '../../../identities/presentation/auth/Field';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { createCommunityInviteUrl } from '../view-models/communityInviteLink';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { IdentityMemberRow } from '../../../identities/presentation/components/IdentityMemberListPanel';
import { loadIdentityPicture } from './communityImages';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRY_DAYS = [1, 7, 14, 30];
const DEFAULT_EXPIRY_DAYS = 7;
const MAX_USES = 100;

type AddCommunityMemberDialogProps = {
  communityId: string;
  onClose: () => void;
  session: Session;
};

export function AddCommunityMemberDialog({
  communityId,
  onClose,
  session,
}: AddCommunityMemberDialogProps) {
  useCloseOnEscape(onClose);

  const [expiryDays, setExpiryDays] = useState(DEFAULT_EXPIRY_DAYS);
  const [maxUses, setMaxUses] = useState(1);
  const [identityInput, setIdentityInput] = useState('');
  const [invitee, setInvitee] = useState<IdentityResource | null>(null);
  const [inviteePictureUrl, setInviteePictureUrl] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [state, setState] = useState<'copied' | 'idle' | 'loading'>('idle');
  const singleUse = maxUses === 1;

  useEffect(() => {
    const identityId = identityInput.trim();

    setInvitee(null);
    setInviteePictureUrl(null);

    if (!identityId || !singleUse) return undefined;

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void applicationContainer.identities
        .get(identityId)
        .then((identity) => {
          if (cancelled) return;

          setInvitee(identity);
          void loadIdentityPicture(identity).then((picture) => {
            if (!cancelled) setInviteePictureUrl(picture);
          });
        })
        .catch(() => undefined);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [identityInput, singleUse]);

  const createLink = async () => {
    if (state === 'loading') return;

    setState('loading');
    setError(null);
    try {
      const { secret } = await applicationContainer.communities.createInvitation(
        session,
        communityId,
        {
          expiresAt: Date.now() + expiryDays * DAY_MS,
          ...(singleUse && invitee ? { invitee: invitee.id } : {}),
          maxUses,
        },
      );
      const link = createCommunityInviteUrl({ communityId, secret });

      setInviteLink(link);
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        setState('copied');
      } else {
        setState('idle');
      }
    } catch (caught) {
      setError(toUserErrorMessage(caught, copy.communities.linkError));
      setState('idle');
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
        <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-5 pb-5">
          <div className="max-w-xl text-sm leading-6 text-white/55">
            {copy.communities.linkHelp}
          </div>
          <Field label={copy.communities.linkExpiry}>
            <select
              value={expiryDays}
              onChange={(event) => setExpiryDays(Number(event.target.value))}
              className="ui-field-control px-3 py-2 text-sm"
            >
              {EXPIRY_DAYS.map((days) => (
                <option key={days} value={days}>
                  {copy.communities.linkExpiryDays.replace(
                    '{count}',
                    String(days),
                  )}
                </option>
              ))}
            </select>
          </Field>
          <Field label={copy.communities.linkMaxUses}>
            <input
              type="number"
              min={1}
              max={MAX_USES}
              value={maxUses}
              onChange={(event) =>
                setMaxUses(
                  Math.min(
                    MAX_USES,
                    Math.max(1, Math.trunc(Number(event.target.value)) || 1),
                  ),
                )
              }
              className="ui-field-control px-3 py-2 text-sm"
            />
          </Field>
          {singleUse && (
            <Field label={copy.communities.linkInvitee}>
              <input
                value={identityInput}
                onChange={(event) => setIdentityInput(event.target.value)}
                className="ui-field-control px-3 py-2 text-sm placeholder:text-white/30"
                placeholder={copy.identityLookup.placeholder}
              />
              <p className="mt-2 text-xs leading-5 text-white/45">
                {copy.communities.linkInviteeHelp}
              </p>
              {invitee && (
                <IdentityMemberRow
                  interactive={false}
                  item={{
                    identity: invitee,
                    identityId: invitee.id,
                    pictureUrl: inviteePictureUrl,
                  }}
                />
              )}
            </Field>
          )}
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
            onClick={() => void createLink()}
            disabled={state === 'loading'}
            className="ui-button ui-button-primary justify-self-start"
          >
            {state === 'loading'
              ? copy.profile.saving
              : state === 'copied'
                ? copy.communities.linkCopied
                : copy.communities.linkInvite}
          </button>
          {error && (
            <div className="ui-inline-notice border-rose-300/25 bg-rose-500/10 text-xs text-rose-100">
              {error}
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}
