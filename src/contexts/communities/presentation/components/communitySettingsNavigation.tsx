import { SettingsNavigation } from '../../../../shared/presentation/components/SettingsNavigation';

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
    <SettingsNavigation
      activeSection={activeSection}
      onSectionChange={onSectionChange}
      sections={sections}
    />
  );
}
