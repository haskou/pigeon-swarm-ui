import { FormEvent, useState } from 'react';

import { pigeonApplication } from '../../application/applicationContainer';
import { API_SERVER_URL } from '../../config';
import { NetworkInviteCode } from '../../domain/networks/NetworkInviteCode';
import { copy } from '../../i18n/en';
import { toUserErrorMessage } from '../../utils/toUserErrorMessage';
import { Field } from '../auth/Field';
import { HeroMetric } from '../auth/HeroMetric';
import { SegmentedControl } from '../common/SegmentedControl';

type NetworkSetupMode = 'create' | 'join';

export function NetworkCreationScreen({
  onNetworkCreated,
}: {
  onNetworkCreated: () => void;
}) {
  const [mode, setMode] = useState<NetworkSetupMode>('create');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const modeOptions = [
    { label: copy.network.create, value: 'create' },
    { label: copy.network.join, value: 'join' },
  ] satisfies Array<{ label: string; value: NetworkSetupMode }>;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'create') {
        await pigeonApplication.createNetwork(name);
      } else {
        const invite = NetworkInviteCode.decode(inviteCode);

        await pigeonApplication.joinNetwork(invite.id, invite.name, invite.key);
      }

      onNetworkCreated();
    } catch (caught) {
      setLoading(false);
      setError(toUserErrorMessage(caught, copy.network.unknownError));
    }
  };

  return (
    <section className="app-screen relative z-10 grid place-items-stretch p-0 sm:place-items-center sm:px-4 sm:py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_480px] lg:items-center">
        <div className="hidden lg:block">
          <div className="glass-panel-strong rounded-2xl p-8">
            <img
              src="/logo.png"
              alt="Pigeon Swarm"
              className="floaty h-28 w-28 rounded-[2rem] shadow-2xl shadow-indigo-950/40"
            />
            <h1 className="mt-8 max-w-xl text-6xl font-black tracking-[-.07em]">
              {copy.network.heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/65">
              {copy.network.heroBody}
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3">
              <HeroMetric
                label={copy.auth.apiLabel}
                value={API_SERVER_URL.replace('http://', '')}
              />
              <HeroMetric
                label={copy.network.firstRunMetricLabel}
                value={copy.network.firstRunMetricValue}
              />
              <HeroMetric
                label={copy.network.modeMetricLabel}
                value={copy.network.modeMetricValue}
              />
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass-panel-strong app-screen rounded-none p-5 sm:min-h-0 sm:rounded-2xl sm:p-7"
        >
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Pigeon Swarm"
              className="h-14 w-14 rounded-2xl border border-white/15 shadow-lg"
            />
            <div>
              <div className="text-2xl font-black tracking-tight">
                {copy.network.title}
              </div>
              <div className="text-sm text-white/55">
                {mode === 'create'
                  ? copy.network.createBody
                  : copy.network.joinBody}
              </div>
            </div>
          </div>

          <SegmentedControl
            className="mt-6"
            value={mode}
            onChange={setMode}
            options={modeOptions}
          />

          <div className="mt-6 space-y-4">
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
            ) : (
              <>
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
              </>
            )}
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-500/15 p-4 text-sm text-rose-100">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="glass-button mt-6 w-full rounded-2xl bg-fuchsia-500 px-5 py-4 text-sm font-black text-white shadow-xl shadow-fuchsia-950/30 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {loading
              ? copy.network.loadingSubmit
              : mode === 'create'
                ? copy.network.createSubmit
                : copy.network.joinSubmit}
          </button>
        </form>
      </div>
    </section>
  );
}
