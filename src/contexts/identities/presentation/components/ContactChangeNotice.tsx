import type { ContactKeyCheck } from '../../domain/ContactPins';

import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { contactKeyNotice } from '../view-models/contactKeyNotice';

export function ContactChangeNotice({
  acknowledged,
  check,
  handle,
  onAcknowledgedChange,
}: {
  acknowledged: boolean;
  check: ContactKeyCheck | null;
  handle: string;
  onAcknowledgedChange: (acknowledged: boolean) => void;
}) {
  const notice = contactKeyNotice(check);

  if (notice === 'none') return null;

  const requiresAcknowledgement = notice === 'verified-change';

  return (
    <div
      className={cx(
        'mt-3 space-y-2 rounded-2xl border p-3 text-sm leading-6',
        requiresAcknowledgement
          ? 'border-amber-300/20 bg-amber-300/10 text-amber-50'
          : 'border-white/10 bg-white/[0.04] text-white/75',
      )}
      role="status"
    >
      <p className="font-bold">{copy.contacts.changedTitle}</p>
      <p>
        {copy.contacts.changedBody.replace('{handle}', `@${handle}`)}
      </p>
      <p>
        {requiresAcknowledgement
          ? copy.contacts.changedVerified
          : copy.contacts.changedUnverified}
      </p>

      {requiresAcknowledgement && (
        <label className="flex items-start gap-2 font-bold">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0"
            checked={acknowledged}
            onChange={(event) => onAcknowledgedChange(event.target.checked)}
          />
          <span>{copy.contacts.changedAcknowledge}</span>
        </label>
      )}
    </div>
  );
}
