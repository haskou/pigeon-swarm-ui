import type {
  Community,
  CommunityMembershipRequest,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  formatTime,
  shortId,
} from '../../../../shared/presentation/formatting';
import {
  identityDisplayName,
  type IdentityNames,
} from '../../../identities/presentation/view-models/identityDisplay';

interface MembershipRequestCardProps {
  communities: Community[];
  currentIdentityId: string;
  identityNames: IdentityNames;
  onAccept: () => void;
  onDecline: () => void;
  request: CommunityMembershipRequest;
  working: boolean;
}

export function MembershipRequestCard({
  communities,
  currentIdentityId,
  identityNames,
  onAccept,
  onDecline,
  request,
  working,
}: MembershipRequestCardProps) {
  const community = communities.find((item) => item.id === request.communityId);
  const actorIdentityId =
    request.type === 'request' ? request.identityId : request.creatorIdentityId;
  const title =
    request.type === 'request'
      ? copy.notifications.communityJoinRequestTitle
      : copy.notifications.communityMembershipInvitationTitle;
  const actorLabel =
    request.type === 'request'
      ? copy.notifications.requestedBy
      : copy.notifications.invitedBy;
  const canRespond =
    request.type === 'invitation'
      ? request.identityId === currentIdentityId
      : community?.ownerIdentityId === currentIdentityId;

  return (
    <article className="rounded-2xl border border-cyan-200/15 bg-cyan-300/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-white">{title}</h3>
          <p className="mt-1 text-sm text-white/55">
            {actorLabel}{' '}
            <span className="font-semibold text-white/75">
              {identityDisplayName(actorIdentityId, identityNames)}
            </span>
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-cyan-300/15 px-2.5 py-1 text-xs font-black text-cyan-100">
          {copy.notifications.states[request.status]}
        </span>
      </div>

      <div className="mt-3 rounded-2xl bg-white/[0.07] p-3 text-xs text-white/55">
        <div className="flex items-center justify-between gap-3">
          <span>{copy.notifications.community}</span>
          <span className="truncate font-semibold text-white/70">
            {community?.name ?? shortId(request.communityId)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span>{copy.notifications.createdAt}</span>
          <span className="font-semibold text-white/70">
            {formatTime(request.createdAt)}
          </span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {canRespond && (
          <>
            <button
              type="button"
              onClick={onAccept}
              disabled={working}
              className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-100 disabled:opacity-50"
            >
              {copy.notifications.accept}
            </button>
            <button
              type="button"
              onClick={onDecline}
              disabled={working}
              className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-black text-white/75 transition hover:bg-white/15 disabled:opacity-50"
            >
              {copy.notifications.decline}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
