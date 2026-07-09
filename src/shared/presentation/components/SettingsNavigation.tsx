import type { ReactElement } from 'react';

import { cx } from '../cx';

export function SettingsNavigation<Section extends string>({
  activeSection,
  ariaLabel,
  onSectionChange,
  sections,
}: {
  activeSection: Section;
  ariaLabel?: string;
  onSectionChange: (section: Section) => void;
  sections: ReadonlyArray<readonly [Section, string]>;
}): ReactElement {
  return (
    <nav className="ui-settings-navigation" aria-label={ariaLabel}>
      {sections.map(([section, label]) => (
        <button
          key={section}
          type="button"
          onClick={() => onSectionChange(section)}
          className={cx(
            'ui-settings-navigation-item',
            activeSection === section && 'is-active',
          )}
          aria-current={activeSection === section ? 'page' : undefined}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
