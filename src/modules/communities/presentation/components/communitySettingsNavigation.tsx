import { cx } from '../../../../shared/presentation/cx';

export type CommunitySettingsSection =
  | 'banned-members'
  | 'channels'
  | 'invitations'
  | 'members'
  | 'moderation-logs'
  | 'profile'
  | 'roles';

export function CommunitySettingsNavigation({
  activeSection,
  onSectionChange,
  sections,
}: {
  activeSection: CommunitySettingsSection;
  onSectionChange: (section: CommunitySettingsSection) => void;
  sections: ReadonlyArray<readonly [CommunitySettingsSection, string]>;
}) {
  return (
    <nav className="mb-4 flex w-full max-w-full flex-wrap gap-2 overflow-visible rounded-2xl bg-black/20 p-2 sm:mb-0 sm:block sm:space-y-1">
      {sections.map(([section, label]) => (
        <button
          key={section}
          type="button"
          onClick={() => onSectionChange(section)}
          className={cx(
            'shrink-0 whitespace-nowrap rounded-xl px-3 py-2 text-left text-xs font-black transition sm:block sm:w-full',
            activeSection === section
              ? 'bg-white text-slate-950'
              : 'text-white/55 hover:bg-white/10',
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
