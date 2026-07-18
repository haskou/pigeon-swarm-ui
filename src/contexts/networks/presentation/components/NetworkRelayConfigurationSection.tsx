import type { NodeRelayConfigurationViewModel } from '../view-models/NodeRelayConfigurationViewModel';

import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { NodeRelayConfigurationForm } from './NodeRelayConfigurationForm';

function ChevronDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="h-4 w-4">
      <path
        d="m7 10 5 5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function NetworkRelayConfigurationSection({
  configuration,
  disabled,
  expanded,
  onChange,
  onToggle,
}: {
  configuration: NodeRelayConfigurationViewModel;
  disabled: boolean;
  expanded: boolean;
  onChange: (configuration: NodeRelayConfigurationViewModel) => void;
  onToggle: () => void;
}) {
  return (
    <div className="mt-5 border-y border-white/10">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-black text-white/75 transition hover:text-white"
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span>{copy.network.configureRelay}</span>
        <span
          aria-hidden="true"
          className={cx(
            'grid h-8 w-8 place-items-center text-white/60 transition-transform',
            expanded && 'rotate-180',
          )}
        >
          <ChevronDownIcon />
        </span>
      </button>
      {expanded ? (
        <div className="border-t border-white/10 py-4">
          <p className="mb-4 text-sm leading-6 text-white/50">
            {copy.network.configureRelayBody}
          </p>
          <NodeRelayConfigurationForm
            className="text-left"
            configuration={configuration}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      ) : null}
    </div>
  );
}
