import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Session } from '../../../identities/infrastructure/session/Session';
import type { CommunityInvitationPreviewResource } from '../../infrastructure/http/resources/CommunityInvitationPreviewResource';
import type { CommunityResource as Community } from '../../infrastructure/http/resources/CommunityResource';
import type { PendingCommunityInviteLink } from '../view-models/communityInviteLink';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { DialogHeader } from '../../../../shared/presentation/components/DialogHeader';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';

type InviteStatus =
  | 'claiming'
  | 'invalid'
  | 'previewing'
  | 'ready'
  | 'waiting';

const ADMISSION_POLL_MS = 5000;

export function PendingCommunityInviteDialog({
  invite,
  onClose,
  onJoined,
  session,
}: {
  invite: PendingCommunityInviteLink;
  onClose: () => void;
  onJoined: (community: Community) => void;
  session: Session;
}) {
  useCloseOnEscape(onClose);

  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] =
    useState<CommunityInvitationPreviewResource | null>(null);
  const [status, setStatus] = useState<InviteStatus>('previewing');

  const joinedRef = useRef(onJoined);

  useEffect(() => {
    joinedRef.current = onJoined;
  }, [onJoined]);

  useEffect(() => {
    let cancelled = false;

    void applicationContainer.communities
      .previewInvitation(invite.communityId, invite.secret)
      .then((loaded) => {
        if (cancelled) return;
        setPreview(loaded);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('invalid');
      });

    return () => {
      cancelled = true;
    };
  }, [invite.communityId, invite.secret]);

  useEffect(() => {
    if (status !== 'waiting') return undefined;

    const timer = window.setInterval(() => {
      void applicationContainer.communities
        .list(session)
        .then((communities) => {
          const joined = communities.find(
            (community) => community.id === invite.communityId,
          );

          if (joined) joinedRef.current(joined);
        })
        .catch(() => undefined);
    }, ADMISSION_POLL_MS);
    return () => window.clearInterval(timer);
  }, [invite.communityId, session, status]);

  const claim = async () => {
    if (!preview || status !== 'ready') return;
    setStatus('claiming');
    setError(null);
    try {
      await applicationContainer.communities.claimInvitation(
        session,
        preview,
        invite.secret,
      );
      setStatus('waiting');
    } catch (caught) {
      if (caught instanceof HttpJsonError && caught.status === 409) {
        setStatus('waiting');

        return;
      }
      setError(toUserErrorMessage(caught, copy.communities.inviteOpenError));
      setStatus('ready');
    }
  };

  return createPortal(
    <div className="app-overlay-scrim fixed inset-0 z-[100] grid place-items-stretch bg-black/60 p-0 backdrop-blur-md sm:place-items-center sm:p-4">
      <section className="app-safe-area-panel ui-dialog-surface relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden sm:h-auto sm:max-h-[84vh] sm:max-w-md">
        <DialogHeader
          description={copy.communities.inviteOpenDescription}
          title={preview?.communityName ?? copy.communities.inviteOpenTitle}
          onClose={onClose}
        />
        <div className="grid gap-4 px-5 pb-5 text-sm leading-6 text-white/65">
          {status === 'previewing' && (
            <p>{copy.communities.inviteOpenPreviewing}</p>
          )}
          {status === 'invalid' && (
            <p className="text-rose-100">{copy.communities.inviteOpenInvalid}</p>
          )}
          {(status === 'ready' || status === 'claiming') && (
            <>
              <p>{copy.communities.inviteOpenConsent}</p>
              <button
                type="button"
                onClick={() => void claim()}
                disabled={status === 'claiming'}
                className="ui-button ui-button-primary justify-self-start"
              >
                {copy.communities.inviteOpenJoin}
              </button>
            </>
          )}
          {status === 'waiting' && (
            <p>{copy.communities.inviteOpenWaiting}</p>
          )}
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
