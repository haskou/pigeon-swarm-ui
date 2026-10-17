import type { CommunityInvitationResource as CommunityInvitation } from '../../infrastructure/http/resources/CommunityInvitationResource';
import type { CommunityResource as Community } from '../../infrastructure/http/resources/CommunityResource';
import type { CommunityMembershipRequestResource as CommunityMembershipRequest } from '../../infrastructure/http/resources/CommunityMembershipRequestResource';
import type { IdentityResource } from '../../../identities/infrastructure/http/resources/IdentityResource';

import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  formatTime,
  shortId,
} from '../../../../shared/presentation/formatting';
import { IdentityMemberRow } from '../../../identities/presentation/components/IdentityMemberListPanel';
import { identityPicture } from '../../../identities/presentation/view-models/identityDisplay';
import { cx } from '../../../../shared/presentation/cx';

export function CommunityInvitationsPanel({
  canApproveRequests,
  canCreateInvitations,
  canManageMembers,
  canRejectRequests,
  community,
  currentIdentityId,
  identityLookup,
  invitations,
  onAccept,
  onCreateInvitation,
  onDecline,
  onRevoke,
  requests,
  state,
}: {
  canApproveRequests: boolean;
  canCreateInvitations: boolean;
  canManageMembers: boolean;
  canRejectRequests: boolean;
  community: Community;
  currentIdentityId: string;
  identityLookup: Record<string, IdentityResource>;
  invitations: CommunityInvitation[];
  onAccept: (requestId: string) => void;
  onCreateInvitation: () => void;
  onDecline: (requestId: string) => void;
  onRevoke: (invitationId: string) => void;
  requests: CommunityMembershipRequest[];
  state: 'idle' | 'loading';
}) {
  return (
    <div className="grid gap-5">
      {(canCreateInvitations || invitations.length > 0) && (
        <section className="ui-list-block">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-white/35">
              {copy.communities.inviteLinks}
            </div>
            {canCreateInvitations && (
              <button
                type="button"
                onClick={onCreateInvitation}
                className="ui-button ui-button-primary"
              >
                {copy.communities.linkInvite}
              </button>
            )}
          </div>
          {invitations.length === 0 ? (
            <div className="border-y border-white/10 py-5 text-sm text-white/45">
              {copy.communities.noInviteLinks}
            </div>
          ) : (
            <div className="divide-y divide-white/10 border-y border-white/15">
              {invitations.map((invitation) => (
                <InvitationRow
                  canRevoke={
                    invitation.live &&
                    (canManageMembers ||
                      invitation.issuerIdentityId === currentIdentityId)
                  }
                  identityLookup={identityLookup}
                  invitation={invitation}
                  key={invitation.id}
                  onRevoke={() => onRevoke(invitation.id)}
                  state={state}
                />
              ))}
            </div>
          )}
        </section>
      )}


      <section className="ui-list-block">
        <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
          {copy.communities.invitations}
        </div>
        {requests.length === 0 ? (
          <div className="border-y border-white/10 py-5 text-sm text-white/45">
            {copy.communities.noMembershipRequests}
          </div>
        ) : (
          <div className="divide-y-2 divide-white/15 border-y border-white/15">
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
      </section>
    </div>
  );
}

function InvitationRow({
  canRevoke,
  identityLookup,
  invitation,
  onRevoke,
  state,
}: {
  canRevoke: boolean;
  identityLookup: Record<string, IdentityResource>;
  invitation: CommunityInvitation;
  onRevoke: () => void;
  state: 'idle' | 'loading';
}) {
  const status = invitation.revoked
    ? copy.communities.inviteLinkRevoked
    : invitation.live
      ? copy.communities.inviteLinkLive
      : copy.communities.inviteLinkClosed;

  return (
    <article className="flex flex-wrap items-center justify-between gap-3 px-3 py-4">
      <div className="min-w-0 text-xs text-white/55">
        <div className="font-semibold text-white/75">
          {identityLabel(invitation.issuerIdentityId, identityLookup)}
          {invitation.invitee &&
            ` → ${identityLabel(invitation.invitee, identityLookup)}`}
        </div>
        <div className="mt-1">
          {status} · {invitation.uses}/{invitation.maxUses} ·{' '}
          {formatTime(invitation.expiresAt)}
        </div>
      </div>
      {canRevoke && (
        <button
          type="button"
          onClick={onRevoke}
          disabled={state === 'loading'}
          className="ui-button disabled:opacity-50"
        >
          {copy.communities.inviteLinkRevoke}
        </button>
      )}
    </article>
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
  const actorIdentityId = request.identityId;
  const targetIdentityId = request.creatorIdentityId;
  const canAct =
    request.status === 'pending' && (canApproveRequests || canRejectRequests);

  return (
    <article
      className={cx(
        'border-l-2 px-3 py-5 even:bg-white/[0.025]',
        request.status === 'pending'
          ? 'border-l-amber-300/45'
          : 'border-l-white/10',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-white">
            {copy.notifications.communityJoinRequestTitle}
          </h3>
          <p className="mt-1 text-xs text-white/45">
            {copy.notifications.requestedBy}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-black text-white/60">
          {copy.notifications.states[request.status]}
        </span>
      </div>

      <IdentitySummary
        identityId={actorIdentityId}
        identityLookup={identityLookup}
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/45">
        <span className="font-semibold text-white/65">{community.name}</span>
        <span aria-hidden="true">·</span>
        <span>{formatTime(request.createdAt)}</span>
        {targetIdentityId !== actorIdentityId && (
          <>
            <span aria-hidden="true">·</span>
            <span>
              {copy.communities.targetMember}:{' '}
              <strong className="font-semibold text-white/65">
                {identityLabel(targetIdentityId, identityLookup)}
              </strong>
            </span>
          </>
        )}
      </div>

      {canAct && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canApproveRequests && (
            <button
              type="button"
              onClick={onAccept}
              disabled={state === 'loading'}
              className="ui-button ui-button-primary disabled:opacity-50"
            >
              {copy.notifications.accept}
            </button>
          )}
          {canRejectRequests && (
            <button
              type="button"
              onClick={onDecline}
              disabled={state === 'loading'}
              className="ui-button disabled:opacity-50"
            >
              {copy.notifications.decline}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function IdentitySummary({
  identityId,
  identityLookup,
}: {
  identityId: string;
  identityLookup: Record<string, IdentityResource>;
}) {
  const identity = identityLookup[identityId];

  return (
    <IdentityMemberRow
      className="mt-3 !rounded-lg !bg-white/[0.04]"
      interactive={false}
      item={{
        identity,
        identityId,
        pictureUrl: identity ? identityPicture(identity) : null,
      }}
    />
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
