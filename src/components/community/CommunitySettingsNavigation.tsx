import { cx } from '../../utils/classNameHelper';

export type CommunitySettingsSection = 'channels' | 'members' | 'profile' | 'roles';

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
    <nav className="mb-4 flex gap-2 overflow-x-auto rounded-2xl bg-black/20 p-2 sm:mb-0 sm:block sm:space-y-1 sm:overflow-visible">
      {sections.map(([section, label]) => (
        <button
          key={section}
          type="button"
          onClick={() => onSectionChange(section)}
          className={cx(
            'shrink-0 rounded-xl px-3 py-2 text-left text-xs font-black transition sm:block sm:w-full',
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
