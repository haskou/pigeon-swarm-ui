import type { IdentityResource } from '../../../../shared/domain/pigeonResources.types';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { shortId } from '../../../../shared/presentation/formatting';
import { IdentityMemberRow } from '../../../identities/presentation/components/IdentityMemberListPanel';
import { identityPicture } from '../../../identities/presentation/view-models/identityDisplay';

export function CommunityBannedMembersPanel({
  bannedMemberIds,
  identityLookup,
  onUnban,
  state,
}: {
  bannedMemberIds: string[];
  identityLookup: Record<string, IdentityResource>;
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
          {bannedMemberIds.map((identityId) => {
            const identity = identityLookup[identityId];

            return (
              <div
                key={identityId}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/8 p-3"
              >
                <div className="min-w-0 flex-1">
                  <IdentityMemberRow
                    className="!max-w-none"
                    interactive={false}
                    item={{
                      identity,
                      identityId,
                      name: identity ? undefined : shortId(identityId),
                      pictureUrl: identity ? identityPicture(identity) : null,
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onUnban(identityId)}
                  disabled={state === 'loading'}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {copy.communities.unbanMember}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
