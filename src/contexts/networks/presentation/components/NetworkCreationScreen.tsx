import { FormEvent, useState } from 'react';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { Field } from '../../../identities/presentation/auth/Field';
import type { NodeRelayConfiguration } from '../../application/configure-node-relay/NodeRelayConfiguration';

import { defaultNodeRelayConfiguration } from '../../application/configure-node-relay/defaultNodeRelayConfiguration';
import { NetworkInviteCode } from '../../domain/NetworkInviteCode';
import { NodeRelayConfigurationForm } from './NodeRelayConfigurationForm';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';

type NetworkSetupMode = 'create' | 'join' | 'public';

export function NetworkCreationScreen({
  onNetworkCreated,
}: {
  onNetworkCreated: () => void;
}) {
  const [mode, setMode] = useState<NetworkSetupMode>('public');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [configureRelay, setConfigureRelay] = useState(false);
  const [relayConfiguration, setRelayConfiguration] =
    useState<NodeRelayConfiguration>(() => defaultNodeRelayConfiguration());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const modeOptions = [
    { label: copy.network.public, value: 'public' },
    { label: copy.network.create, value: 'create' },
    { label: copy.network.join, value: 'join' },
  ] satisfies Array<{ label: string; value: NetworkSetupMode }>;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (configureRelay) {
        await applicationContainer.updateNodeRelayConfiguration(
          relayConfiguration,
        );
      }

      if (mode === 'create') {
        await applicationContainer.createNetwork(name);
      } else if (mode === 'join') {
        const invite = NetworkInviteCode.decode(inviteCode);

        await applicationContainer.joinNetwork(
          invite.id,
          invite.name,
          invite.key,
        );
      } else {
        await applicationContainer.createPublicNodeNetwork();
      }

      onNetworkCreated();
    } catch (caught) {
      setLoading(false);
      setError(toUserErrorMessage(caught, copy.network.unknownError));
    }
  };

  return (
    <section className="app-screen relative z-10 grid min-h-dvh place-items-stretch p-0 sm:place-items-center sm:px-4 sm:py-8">
      <form
        onSubmit={handleSubmit}
        className="glass-panel-strong flex min-h-dvh w-full flex-col justify-center rounded-none p-5 sm:min-h-0 sm:max-w-2xl sm:rounded-2xl sm:p-8"
      >
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="Pigeon Swarm"
            className="h-16 w-16 rounded-2xl border border-white/15 shadow-lg"
          />
          <h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-5xl">
            {copy.network.title}
          </h1>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-white/65">
            {copy.network.body}
          </p>
        </div>

        <SegmentedControl
          className="mt-8"
          columns={3}
          dense
          value={mode}
          onChange={setMode}
          options={modeOptions}
        />

        <div className="mt-6 min-h-[150px] space-y-4">
          <p className="px-1 text-sm leading-relaxed text-white/60">
            {mode === 'create'
              ? copy.network.createBody
              : mode === 'join'
                ? copy.network.joinBody
                : copy.network.publicBody}
          </p>

          {mode === 'create' ? (
            <Field label={copy.network.nameLabel}>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                placeholder={copy.network.namePlaceholder}
                autoComplete="name"
                required
              />
            </Field>
          ) : mode === 'join' ? (
            <Field label={copy.network.inviteCodeLabel}>
              <textarea
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                className="min-h-32 w-full resize-none rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60"
                placeholder={copy.network.inviteCodePlaceholder}
                autoComplete="off"
                required
              />
            </Field>
          ) : null}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/15 p-4">
          <label className="flex items-center justify-between gap-3 text-left text-sm font-black text-white/75">
            <span>{copy.network.configureRelay}</span>
            <input
              type="checkbox"
              role="switch"
              checked={configureRelay}
              onChange={(event) => setConfigureRelay(event.target.checked)}
              className="h-5 w-9 accent-cyan-300"
            />
          </label>
          <p className="mt-2 text-sm leading-6 text-white/50">
            {copy.network.configureRelayBody}
          </p>
          {configureRelay && (
            <NodeRelayConfigurationForm
              className="mt-4 text-left"
              configuration={relayConfiguration}
              disabled={loading}
              onChange={setRelayConfiguration}
            />
          )}
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-4 text-sm text-rose-100">
            {error}
          </div>
        )}

        <button
          disabled={loading}
          className="glass-button mt-6 w-full rounded-2xl bg-[#274279] px-5 py-4 text-sm font-black text-white shadow-xl shadow-[#0b162f]/30 transition hover:scale-[1.01] hover:bg-[#31508e] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading
            ? copy.network.loadingSubmit
            : mode === 'create'
              ? copy.network.createSubmit
              : mode === 'join'
                ? copy.network.joinSubmit
                : copy.network.publicSubmit}
        </button>
      </form>
    </section>
  );
}
