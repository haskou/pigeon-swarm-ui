import type { NodeRelayConfiguration } from '../../application/configure-node-relay/NodeRelayConfiguration';
import type { NodeRelayPortCheckResource } from '../../application/configure-node-relay/NodeRelayPortCheckResource';

import { nodeRelayConfigurationPorts } from '../../application/configure-node-relay/nodeRelayConfigurationPorts';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';

export function NodeRelayConfigurationForm({
  className,
  configuration,
  disabled = false,
  portCheck,
  portCheckError,
  portCheckLoading = false,
  onChange,
  onCheckPorts,
}: {
  className?: string;
  configuration: NodeRelayConfiguration;
  disabled?: boolean;
  onChange: (configuration: NodeRelayConfiguration) => void;
  onCheckPorts?: () => void;
  portCheck?: NodeRelayPortCheckResource | null;
  portCheckError?: string | null;
  portCheckLoading?: boolean;
}) {
  const portTargets = nodeRelayConfigurationPorts(configuration);
  const canCheckPorts =
    !!onCheckPorts &&
    !!configuration.publicHost?.trim() &&
    portTargets.length > 0 &&
    !disabled;

  return (
    <div className={cx('grid gap-3', className)}>
      <section className="rounded-2xl bg-black/20 p-4">
        <div className="mb-3">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
            {copy.nodeSettings.relayPublicHost}
          </div>
          <p className="mt-1 text-sm text-white/50">
            {copy.nodeSettings.relayPublicHostBody}
          </p>
        </div>
        <input
          value={configuration.publicHost ?? ''}
          onChange={(event) =>
            onChange({
              ...configuration,
              publicHost: event.target.value.trim() || undefined,
            })
          }
          disabled={disabled}
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-45"
          placeholder={copy.nodeSettings.relayPublicHostPlaceholder}
          autoComplete="off"
        />
      </section>

      <section className="rounded-2xl bg-black/20 p-4">
        <RelaySectionHeader
          title={copy.nodeSettings.callsRelayTitle}
          body={copy.nodeSettings.callsRelayBody}
        />
        <NumberField
          disabled={disabled}
          label={copy.nodeSettings.callsRelayPort}
          min={1}
          max={65535}
          value={configuration.callsRelay.port}
          onChange={(port) =>
            onChange({
              ...configuration,
              callsRelay: { port },
            })
          }
        />
      </section>

      <section className="rounded-2xl bg-black/20 p-4">
        <RelaySectionHeader
          title={copy.nodeSettings.publicRelayTitle}
          body={copy.nodeSettings.publicRelayBody}
        />
        <div className="grid gap-3">
          <SwitchField
            checked={configuration.publicRelay.enabled}
            disabled={disabled}
            label={copy.nodeSettings.relayEnabledSetting}
            onChange={(enabled) =>
              onChange({
                ...configuration,
                publicRelay: { ...configuration.publicRelay, enabled },
              })
            }
          />
          <SwitchField
            checked={configuration.publicRelay.discoveryEnabled}
            disabled={disabled}
            label={copy.nodeSettings.relayDiscoveryEnabled}
            onChange={(discoveryEnabled) =>
              onChange({
                ...configuration,
                publicRelay: {
                  ...configuration.publicRelay,
                  discoveryEnabled,
                },
              })
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              disabled={disabled || !configuration.publicRelay.enabled}
              label={copy.nodeSettings.publicRelayPort}
              min={1}
              max={65535}
              value={configuration.publicRelay.port}
              onChange={(port) =>
                onChange({
                  ...configuration,
                  publicRelay: { ...configuration.publicRelay, port },
                })
              }
            />
            <NumberField
              disabled={disabled || !configuration.publicRelay.enabled}
              label={copy.nodeSettings.publicRelayLibp2pPort}
              min={1}
              max={65535}
              value={configuration.publicRelay.libp2pPort}
              onChange={(libp2pPort) =>
                onChange({
                  ...configuration,
                  publicRelay: {
                    ...configuration.publicRelay,
                    libp2pPort,
                  },
                })
              }
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-black/20 p-4">
        <RelaySectionHeader
          title={copy.nodeSettings.privateRelayTitle}
          body={copy.nodeSettings.privateRelayBody}
        />
        <div className="grid gap-3">
          <SwitchField
            checked={configuration.privateRelay.enabled}
            disabled={disabled}
            label={copy.nodeSettings.relayEnabledSetting}
            onChange={(enabled) =>
              onChange({
                ...configuration,
                privateRelay: { ...configuration.privateRelay, enabled },
              })
            }
          />
          <SwitchField
            checked={configuration.privateRelay.publicRecordPublicationEnabled}
            disabled={disabled || !configuration.privateRelay.enabled}
            label={copy.nodeSettings.privateRelayPublishRecords}
            onChange={(publicRecordPublicationEnabled) =>
              onChange({
                ...configuration,
                privateRelay: {
                  ...configuration.privateRelay,
                  publicRecordPublicationEnabled,
                },
              })
            }
          />
          <SwitchField
            checked={configuration.privateRelay.publicRecordDiscoveryEnabled}
            disabled={disabled}
            label={copy.nodeSettings.privateRelayDiscoverRecords}
            onChange={(publicRecordDiscoveryEnabled) =>
              onChange({
                ...configuration,
                privateRelay: {
                  ...configuration.privateRelay,
                  publicRecordDiscoveryEnabled,
                },
              })
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              disabled={disabled || !configuration.privateRelay.enabled}
              label={copy.nodeSettings.privateRelayPortStart}
              min={1}
              max={65535}
              value={configuration.privateRelay.portStart}
              onChange={(portStart) =>
                onChange({
                  ...configuration,
                  privateRelay: { ...configuration.privateRelay, portStart },
                })
              }
            />
            <NumberField
              disabled={disabled || !configuration.privateRelay.enabled}
              label={copy.nodeSettings.privateRelayPortEnd}
              min={1}
              max={65535}
              value={configuration.privateRelay.portEnd}
              onChange={(portEnd) =>
                onChange({
                  ...configuration,
                  privateRelay: { ...configuration.privateRelay, portEnd },
                })
              }
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-black/20 p-4">
        <RelaySectionHeader
          title={copy.nodeSettings.manualRelayMultiaddrs}
          body={copy.nodeSettings.manualRelayMultiaddrsBody}
        />
        <textarea
          value={configuration.manualRelayMultiaddrs.join('\n')}
          onChange={(event) =>
            onChange({
              ...configuration,
              manualRelayMultiaddrs: event.target.value
                .split(/\r?\n/)
                .map((value) => value.trim())
                .filter(Boolean),
            })
          }
          disabled={disabled}
          className="min-h-24 w-full resize-y rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-45"
          placeholder="/dns4/relay.example.com/tcp/4100/p2p/12D3KooW..."
          autoComplete="off"
        />
      </section>

      <section className="rounded-2xl border border-cyan-200/15 bg-cyan-300/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100/70">
              {copy.nodeSettings.relayReachabilityTitle}
            </div>
            <p className="mt-1 text-sm leading-6 text-cyan-50/70">
              {copy.nodeSettings.relayReachabilityBody}
            </p>
          </div>
          {onCheckPorts && (
            <button
              type="button"
              onClick={onCheckPorts}
              disabled={!canCheckPorts || portCheckLoading}
              className="shrink-0 rounded-2xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {portCheckLoading
                ? copy.nodeSettings.relayCheckingPorts
                : copy.nodeSettings.relayCheckPorts}
            </button>
          )}
        </div>
        {portTargets.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {portTargets.map((target) => (
              <span
                key={target.id}
                className="rounded-full border border-cyan-200/15 bg-black/20 px-2.5 py-1 text-[0.68rem] font-black uppercase tracking-[0.08em] text-cyan-50/70"
              >
                {target.port}/{target.protocol}
              </span>
            ))}
          </div>
        )}
        {portCheckError && (
          <div className="mt-3 rounded-2xl border border-amber-200/25 bg-amber-300/10 p-3 text-sm text-amber-50/80">
            {portCheckError}
          </div>
        )}
        {portCheck && (
          <div className="mt-3 grid gap-2">
            {portCheck.checks.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-xs"
              >
                <span className="min-w-0 truncate text-white/70">
                  {result.label} · {result.port}/{result.protocol}
                </span>
                <span
                  className={cx(
                    'shrink-0 rounded-full px-2 py-1 font-black uppercase tracking-[0.08em]',
                    result.status === 'reachable'
                      ? 'bg-emerald-300/15 text-emerald-100'
                      : result.status === 'unreachable'
                        ? 'bg-rose-300/15 text-rose-100'
                        : 'bg-white/10 text-white/60',
                  )}
                >
                  {relayPortStatusLabel(result.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function RelaySectionHeader({
  body,
  title,
}: {
  body: string;
  title: string;
}) {
  return (
    <div className="mb-3">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
        {title}
      </div>
      <p className="mt-1 text-sm leading-6 text-white/50">{body}</p>
    </div>
  );
}

function NumberField({
  disabled,
  label,
  max,
  min,
  onChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number | undefined) => void;
  value?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-white/35">
        {label}
      </span>
      <input
        value={value ?? ''}
        onChange={(event) => onChange(toOptionalPort(event.target.value))}
        disabled={disabled}
        min={min}
        max={max}
        type="number"
        inputMode="numeric"
        className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-45"
      />
    </label>
  );
}

function SwitchField({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-black text-white/75">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-9 accent-cyan-300 disabled:cursor-not-allowed disabled:opacity-45"
      />
    </label>
  );
}

function toOptionalPort(value: string): number | undefined {
  if (!value.trim()) return undefined;

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined;

  return port;
}

function relayPortStatusLabel(
  status: 'reachable' | 'unreachable' | 'unknown',
): string {
  switch (status) {
    case 'reachable':
      return copy.nodeSettings.relayPortReachable;
    case 'unreachable':
      return copy.nodeSettings.relayPortUnreachable;
    default:
      return copy.nodeSettings.relayPortUnknown;
  }
}
