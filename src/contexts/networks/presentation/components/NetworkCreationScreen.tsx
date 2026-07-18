import { FormEvent, useState } from 'react';

import type { NodeRelayConfiguration } from '../../application/configure-node-relay/NodeRelayConfiguration';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { Field } from '../../../identities/presentation/auth/Field';
import { defaultNodeRelayConfiguration } from '../../application/configure-node-relay/defaultNodeRelayConfiguration';
import { NetworkInviteCode } from '../../domain/NetworkInviteCode';
import { NodeRelayConfigurationForm } from './NodeRelayConfigurationForm';

type NetworkSetupMode = 'create' | 'join' | 'public';

export function NetworkCreationScreen({
  nodeOwnerId,
  onNetworkCreated,
}: {
  nodeOwnerId: null | string;
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
  const canConfigureRelay = nodeOwnerId === null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (configureRelay && canConfigureRelay) {
        await applicationContainer.networks.updateRelayConfiguration(
          relayConfiguration,
        );
      }

      if (mode === 'create') {
        await applicationContainer.networks.create(name);
      } else if (mode === 'join') {
        const invite = NetworkInviteCode.decode(inviteCode);

        await applicationContainer.networks.join(
          invite.id,
          invite.name,
          invite.key,
        );
      } else {
        await applicationContainer.networks.createPublic();
      }

      onNetworkCreated();
    } catch (caught) {
      setLoading(false);
      setError(toUserErrorMessage(caught, copy.network.unknownError));
    }
  };

  return (
    <section className="app-screen subtle-scrollbar relative z-10 grid h-full min-h-0 place-items-stretch overflow-y-auto overscroll-contain p-0 sm:place-items-start sm:justify-items-center sm:px-4 sm:py-8">
      <form
        onSubmit={handleSubmit}
        className="glass-panel-strong flex min-h-full w-full flex-col rounded-none p-5 sm:min-h-0 sm:max-w-2xl sm:rounded-2xl sm:p-8"
      >
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <img
            src="/logo.png"
            alt="Pigeon Swarm"
            className="h-14 w-14 rounded-xl border border-white/15 shadow-lg"
          />
          <h1 className="mt-5 text-3xl font-black text-white sm:text-4xl">
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

        <div className="mt-6 grid gap-4">
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
                className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
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
                className="ui-field-control min-h-32 resize-none px-4 py-3 text-sm placeholder:text-white/30"
                placeholder={copy.network.inviteCodePlaceholder}
                autoComplete="off"
                required
              />
            </Field>
          ) : null}
        </div>

        {canConfigureRelay && (
          <div className="mt-5 border-y border-white/10">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 py-4 text-left text-sm font-black text-white/75 transition hover:text-white"
              aria-expanded={configureRelay}
              onClick={() => setConfigureRelay((current) => !current)}
            >
              <span>{copy.network.configureRelay}</span>
              <span
                aria-hidden="true"
                className={cx(
                  'grid h-8 w-8 place-items-center text-white/60 transition-transform',
                  configureRelay && 'rotate-180',
                )}
              >
                <ChevronDownIcon />
              </span>
            </button>
            {configureRelay && (
              <div className="border-t border-white/10 py-4">
                <p className="mb-4 text-sm leading-6 text-white/50">
                  {copy.network.configureRelayBody}
                </p>
                <NodeRelayConfigurationForm
                  className="text-left"
                  configuration={relayConfiguration}
                  disabled={loading}
                  onChange={setRelayConfiguration}
                />
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="ui-inline-notice mt-5 border-rose-300/25 bg-rose-500/15 text-sm text-rose-100">
            {error}
          </div>
        )}

        <button
          disabled={loading}
          className="ui-button ui-button-primary mt-6 w-full py-3"
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
