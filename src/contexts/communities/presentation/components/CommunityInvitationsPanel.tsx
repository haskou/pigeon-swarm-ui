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
import { IdentityMemberRow } from '../../../identities/presentation/components/IdentityMemberListPanel';
import { identityPicture } from '../../../identities/presentation/view-models/identityDisplay';
import { cx } from '../../../../shared/presentation/cx';

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
    <div className="grid gap-5">
      {canCreateInvitations && (
        <section className="ui-list-block border-y border-white/10 py-3">
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
              className="ui-field-control min-w-0 flex-1 px-4 py-3 text-sm"
              placeholder={copy.identityLookup.placeholder}
            />
            <button
              type="button"
              onClick={onInvite}
              disabled={!identityInput.trim() || state === 'loading'}
              className="ui-button ui-button-primary disabled:cursor-not-allowed disabled:opacity-45"
            >
              {copy.communities.sendInvitation}
            </button>
          </div>
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
            {request.type === 'request'
              ? copy.notifications.communityJoinRequestTitle
              : copy.notifications.communityMembershipInvitationTitle}
          </h3>
          <p className="mt-1 text-xs text-white/45">
            {request.type === 'request'
              ? copy.notifications.requestedBy
              : copy.notifications.invitedBy}
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
