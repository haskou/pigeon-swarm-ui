import type { NetworkSetupMode } from './NetworkSetupMode';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { Field } from '../../../identities/presentation/auth/Field';

export function NetworkSetupFields({
  inviteCode,
  mode,
  name,
  onInviteCodeChange,
  onNameChange,
}: {
  inviteCode: string;
  mode: NetworkSetupMode;
  name: string;
  onInviteCodeChange: (inviteCode: string) => void;
  onNameChange: (name: string) => void;
}) {
  if (mode === 'create') {
    return (
      <Field label={copy.network.nameLabel}>
        <input
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
          placeholder={copy.network.namePlaceholder}
          autoComplete="name"
          required
        />
      </Field>
    );
  }

  if (mode === 'join') {
    return (
      <Field label={copy.network.inviteCodeLabel}>
        <textarea
          value={inviteCode}
          onChange={(event) => onInviteCodeChange(event.target.value)}
          className="ui-field-control min-h-32 resize-none px-4 py-3 text-sm placeholder:text-white/30"
          placeholder={copy.network.inviteCodePlaceholder}
          autoComplete="off"
          required
        />
      </Field>
    );
  }

  return null;
}
