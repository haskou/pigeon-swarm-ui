import { copy } from '../../i18n/en';
import { shortId } from '../../utils/formatting';

export function CommunityBannedMembersPanel({
  bannedMemberIds,
  onUnban,
  state,
}: {
  bannedMemberIds: string[];
  onUnban: (identityId: string) => void;
  state: 'idle' | 'loading';
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-white/35">
        {copy.communities.bannedMembers}
      </div>
      {bannedMemberIds.length === 0 ? (
        <div className="rounded-2xl bg-white/8 p-4 text-sm text-white/45">
          {copy.communities.noBannedMembers}
        </div>
      ) : (
        <div className="space-y-2">
          {bannedMemberIds.map((identityId) => (
            <div
              key={identityId}
              className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 p-3"
            >
              <span className="min-w-0 truncate text-sm font-black text-white">
                {shortId(identityId)}
              </span>
              <button
                type="button"
                onClick={() => onUnban(identityId)}
                disabled={state === 'loading'}
                className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {copy.communities.unbanMember}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
