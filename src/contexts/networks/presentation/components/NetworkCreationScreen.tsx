import { FormEvent, useState } from 'react';

import type { NodeRelayConfigurationViewModel } from '../view-models/NodeRelayConfigurationViewModel';
import type { NetworkSetupMode } from './NetworkSetupMode';

import { applicationContainer } from '../../../../app/composition/applicationContainer';
import { SegmentedControl } from '../../../../shared/presentation/components/segmentedControl';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../../shared/presentation/toUserErrorMessage';
import { NetworkInviteCode } from '../../domain/NetworkInviteCode';
import { defaultRelayConfiguration } from '../view-models/defaultRelayConfiguration';
import { NetworkRelayConfigurationSection } from './NetworkRelayConfigurationSection';
import { networkSetupBody, networkSetupSubmitLabel } from './networkSetupCopy';
import { NetworkSetupFields } from './NetworkSetupFields';

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
    useState<NodeRelayConfigurationViewModel>(() =>
      defaultRelayConfiguration(),
    );
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
        const invite = NetworkInviteCode.decode(inviteCode).toPrimitives();

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
            {networkSetupBody(mode)}
          </p>

          <NetworkSetupFields
            inviteCode={inviteCode}
            mode={mode}
            name={name}
            onInviteCodeChange={setInviteCode}
            onNameChange={setName}
          />
        </div>

        {canConfigureRelay ? (
          <NetworkRelayConfigurationSection
            configuration={relayConfiguration}
            disabled={loading}
            expanded={configureRelay}
            onChange={setRelayConfiguration}
            onToggle={() => setConfigureRelay((current) => !current)}
          />
        ) : null}

        {error && (
          <div className="ui-inline-notice mt-5 border-rose-300/25 bg-rose-500/15 text-sm text-rose-100">
            {error}
          </div>
        )}

        <button
          disabled={loading}
          className="ui-button ui-button-primary mt-6 w-full py-3"
        >
          {networkSetupSubmitLabel(mode, loading)}
        </button>
      </form>
    </section>
  );
}
