import { useState, type ReactElement } from 'react';

import type { IdentityNames } from '../../../../contexts/identities/presentation/view-models/identityDisplay';
import type {
  Community,
  ConversationResource,
  IdentityResource,
  Session,
} from '../../../../shared/domain/pigeonResources.types';
import type { ProfileKeychainDisplayEntry } from './ProfileKeychainDisplayEntry';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { ProfileKeychainEntries } from './ProfileKeychainEntries';

type ProfileKeychainSectionProps = {
  communities: Community[];
  conversations: ConversationResource[];
  identityNames: IdentityNames;
  identityProfiles: Record<string, IdentityResource>;
  session: Session;
};

export function ProfileKeychainSection({
  communities,
  conversations,
  identityNames,
  identityProfiles,
  session,
}: ProfileKeychainSectionProps): ReactElement {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const entries = ProfileKeychainEntries.from({
    communities,
    conversations,
    identityNames,
    identityProfiles,
    session,
  });

  const copyValue = async (
    entry: ProfileKeychainDisplayEntry,
  ): Promise<void> => {
    if (
      entry.sensitive &&
      !window.confirm(copy.profile.copySensitiveKeyConfirm)
    ) {
      return;
    }

    if (navigator.clipboard) await navigator.clipboard.writeText(entry.key);

    setCopiedKey(entry.id);
    window.setTimeout(() => setCopiedKey(null), 1600);
  };

  return (
    <section className="ui-section">
      <div className="border-b border-white/[0.06] py-3">
        <div className="text-sm font-black text-white/70">
          {copy.profile.keychainTab}
        </div>
        <p className="mt-1 text-xs font-bold leading-relaxed text-white/40">
          {copy.profile.keychainHelp}
        </p>
      </div>
      <div>
        {entries.length === 0 ? (
          <div className="py-5 text-sm font-semibold text-white/45">
            {copy.profile.noKeychainKeys}
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="ui-list-block">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white/80">
                    {entry.title}
                  </div>
                  {entry.subtitle && (
                    <div className="mt-1 truncate text-xs font-semibold text-white/40">
                      {entry.subtitle}
                    </div>
                  )}
                </div>
                <span className="shrink-0 text-[0.65rem] font-black uppercase text-white/45">
                  {entry.algorithm}
                </span>
              </div>
              <div className="mt-3 flex min-w-0 items-center gap-2 border-t border-white/[0.06] pt-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-mono text-white/45">
                  ••••••••••••••••••••••••
                </span>
                <button
                  type="button"
                  onClick={() => void copyValue(entry)}
                  className="shrink-0 rounded-lg bg-white/10 px-2 py-1 font-black text-white/70 transition hover:bg-white/15 hover:text-white"
                >
                  {copiedKey === entry.id
                    ? copy.profile.copied
                    : copy.profile.copy}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
