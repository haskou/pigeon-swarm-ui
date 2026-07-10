import type {
  Community,
  CommunityMembershipRequest,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import {
  formatTime,
  shortId,
} from '../../../../shared/presentation/formatting';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  identityDisplayName,
  type IdentityNames,
} from '../../../identities/presentation/view-models/identityDisplay';

interface MembershipRequestCardProps {
  communities: Community[];
  currentIdentityId: string;
  identityNames: IdentityNames;
  identityProfiles: Record<string, IdentityResource>;
  onAccept: () => void;
  onDecline: () => void;
  request: CommunityMembershipRequest;
  working: boolean;
}

function membershipRequestActorIdentityId(
  request: CommunityMembershipRequest,
): string {
  return request.type === 'request'
    ? request.identityId
    : request.creatorIdentityId;
}

function membershipRequestTitle(request: CommunityMembershipRequest): string {
  return request.type === 'request'
    ? copy.notifications.communityJoinRequestTitle
    : copy.notifications.communityMembershipInvitationTitle;
}

function membershipRequestActorLabel(
  request: CommunityMembershipRequest,
): string {
  return request.type === 'request'
    ? copy.notifications.requestedBy
    : copy.notifications.invitedBy;
}

function canRespondToMembershipRequest({
  community,
  currentIdentityId,
  request,
}: {
  community?: Community;
  currentIdentityId: string;
  request: CommunityMembershipRequest;
}): boolean {
  return request.type === 'invitation'
    ? request.identityId === currentIdentityId
    : community?.ownerIdentityId === currentIdentityId;
}

function isIdentityLoading(input: {
  identityId: string;
  identityNames: IdentityNames;
  identityProfiles: Record<string, IdentityResource>;
}): boolean {
  const actorName = input.identityNames[input.identityId];

  return (
    !input.identityProfiles[input.identityId] &&
    (!actorName || actorName === input.identityId)
  );
}

export function MembershipRequestCard({
  communities,
  currentIdentityId,
  identityNames,
  identityProfiles,
  onAccept,
  onDecline,
  request,
  working,
}: MembershipRequestCardProps) {
  const community = communities.find((item) => item.id === request.communityId);
  const actorIdentityId = membershipRequestActorIdentityId(request);
  const actorLoading = isIdentityLoading({
    identityId: actorIdentityId,
    identityNames,
    identityProfiles,
  });
  const canRespond = canRespondToMembershipRequest({
    community,
    currentIdentityId,
    request,
  });

  return (
    <article className="rounded-md border border-white/10 border-l-2 border-l-fuchsia-300/45 bg-white/[0.025] px-4 py-4 shadow-sm shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-white">
            {membershipRequestTitle(request)}
          </h3>
          <p className="mt-1 text-sm text-white/55">
            {membershipRequestActorLabel(request)}{' '}
            {actorLoading ? (
              <span className="inline-block h-3.5 w-24 animate-pulse rounded-full bg-white/18 align-middle" />
            ) : (
              <span className="font-semibold text-white/75">
                {identityDisplayName(actorIdentityId, identityNames)}
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-cyan-300/15 px-2.5 py-1 text-xs font-black text-cyan-100">
          {copy.notifications.states[request.status]}
        </span>
      </div>

      <div className="mt-3 border-y border-white/[0.08] py-3 text-xs text-white/55">
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
              className="ui-button ui-button-primary"
            >
              {copy.notifications.accept}
            </button>
            <button
              type="button"
              onClick={onDecline}
              disabled={working}
              className="ui-button"
            >
              {copy.notifications.decline}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
