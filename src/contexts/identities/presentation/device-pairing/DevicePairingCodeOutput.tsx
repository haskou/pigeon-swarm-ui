import { type ReactElement, useRef, useState } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';

export function DevicePairingCodeOutput({
  label,
  testId,
  value,
}: {
  label: string;
  testId?: string;
  value: string;
}): ReactElement {
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const [copied, setCopied] = useState(false);
  const copyCode = async () => {
    textarea.current?.select();

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-2">
      <label className="text-xs font-black text-white/60">{label}</label>
      <textarea
        aria-label={label}
        className="ui-field-control min-h-24 resize-none px-3 py-2 font-mono text-xs"
        data-testid={testId}
        onFocus={(event) => event.currentTarget.select()}
        readOnly
        ref={textarea}
        spellCheck={false}
        value={value}
      />
      <button
        className="ui-button justify-self-start"
        onClick={() => void copyCode()}
        type="button"
      >
        {copied ? copy.devicePairing.copied : copy.devicePairing.copyCode}
      </button>
    </div>
  );
}
