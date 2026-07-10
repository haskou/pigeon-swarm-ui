import type { CommunityVisibility } from '../../../../shared/domain/pigeonResources.types';

import { CommunityAutoJoinSwitch } from './CommunityAutoJoinSwitch';
import { CommunityDiscoverySwitch } from './CommunityDiscoverySwitch';
import { CommunityVisibilitySelector } from './CommunityVisibilitySelector';

type CommunityPublicSettingsPanelProps = {
  autoJoinEnabled: boolean;
  discoverable: boolean;
  disabled?: boolean;
  framed?: boolean;
  onAutoJoinChange: (checked: boolean) => void;
  onDiscoverableChange: (checked: boolean) => void;
  onVisibilityChange?: (visibility: CommunityVisibility) => void;
  visibility?: CommunityVisibility;
};

export function CommunityPublicSettingsPanel({
  autoJoinEnabled,
  discoverable,
  disabled = false,
  framed = true,
  onAutoJoinChange,
  onDiscoverableChange,
  onVisibilityChange,
  visibility,
}: CommunityPublicSettingsPanelProps) {
  const showAutoJoin = visibility === 'public';

  return (
    <section
      className={
        framed ? 'rounded-2xl border border-white/10 bg-black/20 p-4' : ''
      }
    >
      {visibility && onVisibilityChange && (
        <CommunityVisibilitySelector
          disabled={disabled}
          onChange={onVisibilityChange}
          value={visibility}
        />
      )}
      <div className="my-3 h-px bg-white/10" />
      <CommunityDiscoverySwitch
        checked={discoverable}
        disabled={disabled}
        onChange={onDiscoverableChange}
      />
      {showAutoJoin ? (
        <>
          <div className="my-3 h-px bg-white/10" />
          <CommunityAutoJoinSwitch
            checked={autoJoinEnabled}
            disabled={disabled}
            onChange={onAutoJoinChange}
          />
        </>
      ) : null}
    </section>
  );
}
