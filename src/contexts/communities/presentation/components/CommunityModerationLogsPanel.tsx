import type {
  Community,
  CommunityChannel,
  CommunityModerationLog,
  CommunityPermission,
  CommunityRoleResource,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  formatTime,
  shortId,
} from '../../../../shared/presentation/formatting';
import { IdentityMemberRow } from '../../../identities/presentation/components/IdentityMemberListPanel';
import { identityPicture } from '../../../identities/presentation/view-models/identityDisplay';

export function CommunityModerationLogsPanel({
  community,
  identityLookup,
  loading,
  logs,
  nextBeforeLogId,
  onLoadMore,
  roles,
}: {
  community: Community;
  identityLookup: Record<string, IdentityResource>;
  loading: boolean;
  logs: CommunityModerationLog[];
  nextBeforeLogId?: string;
  onLoadMore: () => void;
  roles: CommunityRoleResource[];
}) {
  const channels = [
    ...community.textChannels,
    ...(community.voiceChannels ?? []),
  ];

  return (
    <section className="ui-list-block">
      <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {copy.communities.moderationLogs}
      </div>
      {logs.length === 0 ? (
        <div className="border-y border-white/10 py-5 text-sm text-white/45">
          {loading
            ? copy.communities.moderationLogsLoading
            : copy.communities.noModerationLogs}
        </div>
      ) : (
        <div className="divide-y divide-white/10 border-y border-white/10">
          {logs.map((log) => (
            <ModerationLogRow
              channels={channels}
              identityLookup={identityLookup}
              key={log.id}
              log={log}
              roles={roles}
            />
          ))}
        </div>
      )}
      {nextBeforeLogId && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="ui-button mt-4 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading
            ? copy.communities.moderationLogsLoading
            : copy.communities.loadMoreModerationLogs}
        </button>
      )}
    </section>
  );
}

function ModerationLogRow({
  channels,
  identityLookup,
  log,
  roles,
}: {
  channels: CommunityChannel[];
  identityLookup: Record<string, IdentityResource>;
  log: CommunityModerationLog;
  roles: CommunityRoleResource[];
}) {
  const title =
    copy.communities.moderationActions[log.action] ?? prettify(log.action);
  const target = targetLabel(log, channels, roles, identityLookup);

  return (
    <article className="py-4 first:pt-2 last:pb-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-white">{title}</h3>
          <p className="mt-1 text-xs text-white/45">
            {copy.communities.moderationActor}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-black text-white/55">
          {formatTime(log.createdAt)}
        </span>
      </div>

      <ModerationActor
        identityId={log.actorIdentityId}
        identityLookup={identityLookup}
      />

      <div className="mt-3 grid border-t border-white/10 text-xs text-white/55">
        <div className="grid gap-1 border-b border-white/10 py-2 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)] sm:gap-3">
          <span className="min-w-0">{copy.communities.moderationTarget}</span>
          <span className="min-w-0 break-all font-semibold text-white/70 sm:text-right">
            {target}
          </span>
        </div>
        {Object.entries(log.details ?? {}).map(([key, value]) => (
          <div
            className="grid gap-1 border-b border-white/10 py-2 last:border-b-0 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)] sm:gap-3"
            key={key}
          >
            <span className="min-w-0 break-all">{prettify(key)}</span>
            <span className="min-w-0 break-all font-semibold text-white/70 sm:text-right">
              {detailLabel(value, roles)}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ModerationActor({
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
        name: identity ? undefined : shortId(identityId),
        pictureUrl: identity ? identityPicture(identity) : null,
      }}
    />
  );
}

function targetLabel(
  log: CommunityModerationLog,
  channels: CommunityChannel[],
  roles: CommunityRoleResource[],
  identityLookup: Record<string, IdentityResource>,
): string {
  if (log.target.type === 'channel') {
    return (
      channels.find((channel) => channel.id === log.target.id)?.name ??
      shortId(log.target.id)
    );
  }

  if (log.target.type === 'role') {
    return (
      roles.find((role) => role.id === log.target.id)?.name ??
      shortId(log.target.id)
    );
  }

  if (log.target.type === 'member') {
    return identityLabel(log.target.id, identityLookup);
  }

  return `${prettify(log.target.type)} ${shortId(log.target.id)}`;
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

function detailLabel(value: unknown, roles: CommunityRoleResource[]): string {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'string'
          ? (roles.find((role) => role.id === item)?.name ??
            permissionLabel(item))
          : String(item),
      )
      .join(', ');
  }

  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }

  if (value === undefined || value === null) return '—';

  return String(value);
}

function prettify(value: string): string {
  const words = value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');

  return `${words.slice(0, 1).toUpperCase()}${words.slice(1)}`;
}

function permissionLabel(value: string): string {
  return (
    copy.communities.permissions[value as CommunityPermission] ??
    prettify(value)
  );
}
