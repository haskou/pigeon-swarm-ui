import type { ReactElement } from 'react';

import type { AuthMode } from './authFormRules';

import { GlassSelect } from '../../../../shared/presentation/components/glassSelect';
import { ProfileHandle } from '../../domain/profile/profileHandle';
import { ProfileName } from '../../domain/profile/profileName';
import { copy } from '../../../../shared/presentation/i18n/en';
import { normalizeHandleInput } from './credentialsValidation';
import { Field } from './field';

interface AuthFormFieldsProps {
  availableNetworks: Array<{ id: string; name: string }>;
  handle: string;
  identityId: string;
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
    return (
      <Field label={copy.auth.identityIdLabel}>
        <input
          value={props.identityId}
          onChange={(event) => props.onIdentityIdChange(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
          placeholder="@ada"
          autoComplete="username"
        />
        <p className="mt-2 text-xs leading-relaxed text-white/40">
          {copy.auth.identityIdHelp}
        </p>
      </Field>
    );
  }

  return (
    <>
      <Field label={copy.auth.profileNameLabel}>
        <input
          value={props.name}
          onChange={(event) => props.onNameChange(event.target.value)}
          maxLength={ProfileName.MAX_LENGTH}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
          placeholder="Ada"
          autoComplete="name"
        />
      </Field>
      <Field label={copy.auth.handleLabel}>
        <input
          value={props.handle}
          onChange={(event) =>
            props.onHandleChange(normalizeHandleInput(event.target.value))
          }
          maxLength={ProfileHandle.MAX_LENGTH}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
          placeholder="@ada"
          autoComplete="username"
        />
      </Field>
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
        className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
        placeholder="uuid-public, uuid-private"
      />
    </Field>
  );
}
