import type {
  Community,
  CommunityMembershipRequest,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  formatTime,
  shortId,
} from '../../../../shared/presentation/formatting';

export function CommunityInvitationsPanel({
  canApproveRequests,
  canCreateInvitations,
  canRejectRequests,
  community,
  identityInput,
  identityLookup,
  onAccept,
  onDecline,
  onIdentityInputChange,
  onInvite,
  requests,
  state,
}: {
  canApproveRequests: boolean;
  canCreateInvitations: boolean;
  canRejectRequests: boolean;
  community: Community;
  identityInput: string;
  identityLookup: Record<string, IdentityResource>;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onIdentityInputChange: (value: string) => void;
  onInvite: () => void;
  requests: CommunityMembershipRequest[];
  state: 'idle' | 'loading';
}) {
  return (
    <div className="grid gap-4">
      {canCreateInvitations && (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
            {copy.communities.inviteMember}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={identityInput}
              onChange={(event) => onIdentityInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                onInvite();
              }}
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
              placeholder={copy.identityLookup.placeholder}
            />
            <button
              type="button"
              onClick={onInvite}
              disabled={!identityInput.trim() || state === 'loading'}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copy.communities.sendInvitation}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
          {copy.communities.invitations}
        </div>
        {requests.length === 0 ? (
          <div className="rounded-2xl bg-white/8 p-4 text-sm text-white/45">
            {copy.communities.noMembershipRequests}
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <MembershipRequestRow
                canApproveRequests={canApproveRequests}
                canRejectRequests={canRejectRequests}
                community={community}
                identityLookup={identityLookup}
                key={request.id}
                onAccept={() => onAccept(request.id)}
                onDecline={() => onDecline(request.id)}
                request={request}
                state={state}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MembershipRequestRow({
  canApproveRequests,
  canRejectRequests,
  community,
  identityLookup,
  onAccept,
  onDecline,
  request,
  state,
}: {
  canApproveRequests: boolean;
  canRejectRequests: boolean;
  community: Community;
  identityLookup: Record<string, IdentityResource>;
  onAccept: () => void;
  onDecline: () => void;
  request: CommunityMembershipRequest;
  state: 'idle' | 'loading';
}) {
  const actorIdentityId =
    request.type === 'request' ? request.identityId : request.creatorIdentityId;
  const targetIdentityId =
    request.type === 'request' ? request.creatorIdentityId : request.identityId;
  const canAct =
    request.status === 'pending' &&
    request.type === 'request' &&
    (canApproveRequests || canRejectRequests);

  return (
    <article className="rounded-2xl bg-white/8 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-white">
            {request.type === 'request'
              ? copy.notifications.communityJoinRequestTitle
              : copy.notifications.communityMembershipInvitationTitle}
          </h3>
          <p className="mt-1 text-sm text-white/55">
            {request.type === 'request'
              ? copy.notifications.requestedBy
              : copy.notifications.invitedBy}{' '}
            <span className="font-semibold text-white/80">
              {identityLabel(actorIdentityId, identityLookup)}
            </span>
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-black text-white/60">
          {copy.notifications.states[request.status]}
        </span>
      </div>

      <div className="mt-3 grid gap-2 rounded-2xl bg-black/20 p-3 text-xs text-white/55">
        <div className="flex items-center justify-between gap-3">
          <span>{copy.notifications.community}</span>
          <span className="truncate font-semibold text-white/70">
            {community.name}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>{copy.communities.targetMember}</span>
          <span className="truncate font-semibold text-white/70">
            {identityLabel(targetIdentityId, identityLookup)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>{copy.notifications.createdAt}</span>
          <span className="font-semibold text-white/70">
            {formatTime(request.createdAt)}
          </span>
        </div>
      </div>

      {canAct && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canApproveRequests && (
            <button
              type="button"
              onClick={onAccept}
              disabled={state === 'loading'}
              className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-100 disabled:opacity-50"
            >
              {copy.notifications.accept}
            </button>
          )}
          {canRejectRequests && (
            <button
              type="button"
              onClick={onDecline}
              disabled={state === 'loading'}
              className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-black text-white/75 transition hover:bg-white/15 disabled:opacity-50"
            >
              {copy.notifications.decline}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function identityLabel(
  identityId: string,
  identityLookup: Record<string, IdentityResource>,
): string {
  const identity = identityLookup[identityId];
  const name = identity?.profile.name.trim();
  const handle = identity?.profile.handle?.trim();

  if (name) return name;
  if (handle) return `@${handle}`;

  return shortId(identityId);
}
