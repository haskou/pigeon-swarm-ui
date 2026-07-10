import type { ReactElement } from 'react';

import type { AuthMode } from './authFormRules';

import { GlassSelect } from '../../../../shared/presentation/components/glassSelect';
import {
  IDENTITY_PROFILE_HANDLE_MAX_LENGTH,
  IDENTITY_PROFILE_NAME_MAX_LENGTH,
} from '../../domain/profile/IdentityProfileConstraints';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { normalizeHandleInput } from './credentialsValidation';
import { Field } from './Field';

interface AuthFormFieldsProps {
  availableNetworks: Array<{ id: string; name: string }>;
  handle: string;
  identityId: string;
  identitySelected: boolean;
  mode: AuthMode;
  name: string;
  networks: string;
  selectedNetwork: string;
  onHandleChange: (value: string) => void;
  onIdentityIdChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onNetworksChange: (value: string) => void;
  onSelectedNetworkChange: (value: string) => void;
}

export function AuthFormFields(props: AuthFormFieldsProps): ReactElement {
  if (props.mode === 'login') {
    if (props.identitySelected) return <></>;

    return (
      <Field label={copy.identityLookup.label}>
        <input
          value={props.identityId}
          onChange={(event) => props.onIdentityIdChange(event.target.value)}
          className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
          placeholder={copy.identityLookup.placeholder}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          data-testid="auth-identity-input"
          spellCheck={false}
        />
        <p className="mt-2 text-xs leading-relaxed text-white/40">
          {copy.identityLookup.help}
        </p>
      </Field>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={copy.auth.profileNameLabel}>
          <input
            value={props.name}
            onChange={(event) => props.onNameChange(event.target.value)}
            maxLength={IDENTITY_PROFILE_NAME_MAX_LENGTH}
            className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
            placeholder="Ada"
            autoComplete="name"
            data-testid="auth-name-input"
          />
        </Field>
        <Field label={copy.auth.handleLabel}>
          <input
            value={props.handle}
            onChange={(event) =>
              props.onHandleChange(normalizeHandleInput(event.target.value))
            }
            maxLength={IDENTITY_PROFILE_HANDLE_MAX_LENGTH}
            className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
            placeholder="@ada"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            data-testid="auth-handle-input"
            spellCheck={false}
          />
        </Field>
      </div>
      <NetworkField {...props} />
    </>
  );
}

function NetworkField(props: {
  availableNetworks: Array<{ id: string; name: string }>;
  networks: string;
  selectedNetwork: string;
  onNetworksChange: (value: string) => void;
  onSelectedNetworkChange: (value: string) => void;
}): ReactElement {
  if (props.availableNetworks.length > 0) {
    return (
      <Field label={copy.auth.networkLabel}>
        <GlassSelect
          ariaLabel={copy.auth.networkLabel}
          value={props.selectedNetwork}
          onChange={props.onSelectedNetworkChange}
          data-testid="auth-network-select"
          options={props.availableNetworks.map((network) => ({
            label: network.name,
            value: network.id,
          }))}
        />
      </Field>
    );
  }

  return (
    <Field label={copy.auth.fallbackNetworksLabel}>
      <input
        value={props.networks}
        onChange={(event) => props.onNetworksChange(event.target.value)}
        className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
        placeholder="uuid-public, uuid-private"
        autoCapitalize="none"
        autoCorrect="off"
        data-testid="auth-networks-input"
        spellCheck={false}
      />
    </Field>
  );
}
