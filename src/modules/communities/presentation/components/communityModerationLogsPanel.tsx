import type {
  Community,
  CommunityChannel,
  CommunityModerationLog,
  CommunityRoleResource,
  IdentityResource,
} from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/en';
import { formatTime, shortId } from '../../../../shared/presentation/formatting';

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
  const channels = [...community.textChannels, ...(community.voiceChannels ?? [])];

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {copy.communities.moderationLogs}
      </div>
      {logs.length === 0 ? (
        <div className="rounded-2xl bg-white/8 p-4 text-sm text-white/45">
          {loading
            ? copy.communities.moderationLogsLoading
            : copy.communities.noModerationLogs}
        </div>
      ) : (
        <div className="space-y-3">
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
          className="mt-4 rounded-2xl bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading
            ? copy.communities.moderationLogsLoading
            : copy.communities.loadMoreModerationLogs}
        </button>
      )}
    </div>
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
    <article className="rounded-2xl bg-white/8 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-black text-white">{title}</h3>
          <p className="mt-1 text-sm text-white/55">
            {copy.communities.moderationActor}{' '}
            <span className="font-semibold text-white/80">
              {identityLabel(log.actorIdentityId, identityLookup)}
            </span>
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-xs font-black text-white/55">
          {formatTime(log.createdAt)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 rounded-2xl bg-black/20 p-3 text-xs text-white/55">
        <div className="flex items-center justify-between gap-3">
          <span>{copy.communities.moderationTarget}</span>
          <span className="truncate font-semibold text-white/70">
            {target}
          </span>
        </div>
        {Object.entries(log.details ?? {}).map(([key, value]) => (
          <div className="flex items-center justify-between gap-3" key={key}>
            <span>{prettify(key)}</span>
            <span className="truncate font-semibold text-white/70">
              {detailLabel(value, roles)}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function targetLabel(
  log: CommunityModerationLog,
  channels: CommunityChannel[],
  roles: CommunityRoleResource[],
  identityLookup: Record<string, IdentityResource>,
): string {
  if (log.target.type === 'channel') {
    return channels.find((channel) => channel.id === log.target.id)?.name ?? shortId(log.target.id);
  }

  if (log.target.type === 'role') {
    return roles.find((role) => role.id === log.target.id)?.name ?? shortId(log.target.id);
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

function detailLabel(
  value: unknown,
  roles: CommunityRoleResource[],
): string {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'string'
          ? (roles.find((role) => role.id === item)?.name ?? item)
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
  return value.replace(/_/g, ' ');
}
