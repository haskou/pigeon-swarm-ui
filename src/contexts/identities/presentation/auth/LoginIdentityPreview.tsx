import type { ReactElement } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { IdentityMemberRow } from '../components/IdentityMemberListPanel';
import { useIdentityPreview } from '../hooks/useIdentityPreview';
import { Field } from './Field';

export function LoginIdentityPreview({
  onClear,
  preview,
}: {
  onClear: () => void;
  preview: ReturnType<typeof useIdentityPreview>;
}): ReactElement | null {
  if (!preview.identity) return null;

  return (
    <Field label={copy.identityLookup.label}>
      <div
        className="ui-field-control flex items-center gap-2 p-1.5"
        data-testid="auth-identity-preview"
      >
        <IdentityMemberRow
          className="!h-14 !min-h-14 !max-w-none !rounded-xl !bg-transparent !p-2"
          interactive={false}
          item={{
            identity: preview.identity,
            identityId: preview.identity.id,
            pictureUrl: preview.pictureUrl,
          }}
        />
        <div className="hidden shrink-0 text-right text-xs sm:block">
          <div className="font-black text-white/65">
            {copy.auth.identityPreviewVersion.replace(
              '{version}',
              String(preview.identity.version),
            )}
          </div>
          <div className="mt-1 text-white/35">
            {formatIdentityPreviewDate(preview.identity.timestamp)}
          </div>
        </div>
        <button
          type="button"
          aria-label={copy.auth.changeIdentity}
          className="ui-icon-button h-10 w-10 shrink-0"
          onClick={onClear}
        >
          <span aria-hidden="true" className="text-xl leading-none">
            ×
          </span>
        </button>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 px-1 text-xs sm:hidden">
        <span className="font-black text-white/55">
          {copy.auth.identityPreviewVersion.replace(
            '{version}',
            String(preview.identity.version),
          )}
        </span>
        <span className="truncate text-right text-white/35">
          {formatIdentityPreviewDate(preview.identity.timestamp)}
        </span>
      </div>
    </Field>
  );
}

function formatIdentityPreviewDate(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return '';

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}
