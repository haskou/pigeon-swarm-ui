import { useEffect, useState } from 'react';

import { CopyIcon } from '../../../../contexts/messages/presentation/components/messageActionIcons';
import { copy } from '../../../../shared/presentation/i18n/copy';

const COPIED_FEEDBACK_MS = 1800;

/**
 * A labelled public identifier or fingerprint with a copy button. Only ever
 * pass ids and fingerprints: the value is rendered and copied as is.
 */
export function CopyableIdRow({
  label,
  value,
}: {
  label: string;
  value: null | string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timer = window.setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);

    return () => window.clearTimeout(timer);
  }, [copied]);

  const copyValue = async () => {
    if (!value || !navigator.clipboard) return;

    await navigator.clipboard.writeText(value);
    setCopied(true);
  };

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.25rem] items-center gap-x-2 py-2.5">
      <div className="min-w-0">
        <div className="text-xs font-bold text-white/45">{label}</div>
        <code className="mt-0.5 block break-all font-mono text-xs leading-5 text-white/80">
          {value ?? copy.encryption.empty}
        </code>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => void copyValue()}
          className="ui-icon-button h-9 w-9 shrink-0"
          aria-label={`${copy.profile.copy}: ${label}`}
        >
          {copied ? (
            <span aria-live="polite" className="text-xs font-black">
              ✓<span className="sr-only">{copy.profile.copied}</span>
            </span>
          ) : (
            <CopyIcon />
          )}
        </button>
      )}
    </div>
  );
}
