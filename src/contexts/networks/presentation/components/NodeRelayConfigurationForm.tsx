import type { NodeRelayConfiguration } from '../../application/configure-node-relay/NodeRelayConfiguration';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';

export function NodeRelayConfigurationForm({
  className,
  configuration,
  disabled = false,
  onChange,
}: {
  className?: string;
  configuration: NodeRelayConfiguration;
  disabled?: boolean;
  onChange: (configuration: NodeRelayConfiguration) => void;
}) {
  return (
    <div className={cx('grid gap-3', className)}>
      <section className="rounded-2xl bg-black/20 p-4">
        <RelaySectionHeader
          title={copy.nodeSettings.publicAccessTitle}
          body={copy.nodeSettings.publicAccessBody}
        />
        <div className="grid gap-3">
          <TextField
            disabled={disabled}
            label={copy.nodeSettings.relayPublicHost}
            placeholder={copy.nodeSettings.relayPublicHostPlaceholder}
            value={configuration.publicHost ?? ''}
            onChange={(publicHost) =>
              onChange({
                ...configuration,
                publicHost,
              })
            }
          />
          <div className="grid gap-3 sm:grid-cols-2">
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
            <NumberField
              disabled={disabled}
              label={copy.nodeSettings.publicNetworkPort}
              min={1}
              max={65535}
              value={configuration.publicNetwork.port}
              onChange={(port) =>
                onChange({
                  ...configuration,
                  publicNetwork: {
                    enabled: port !== undefined,
                    port,
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
            checked={configuration.privateRelay.discoveryEnabled}
            disabled={disabled}
            label={copy.nodeSettings.privateRelayDiscoverRecords}
            onChange={(discoveryEnabled) =>
              onChange({
                ...configuration,
                privateRelay: {
                  ...configuration.privateRelay,
                  discoveryEnabled,
                },
              })
            }
          />
          <SwitchField
            checked={configuration.privateRelay.enabled}
            disabled={disabled}
            label={copy.nodeSettings.privateRelayEnabledSetting}
            onChange={(enabled) =>
              onChange({
                ...configuration,
                privateRelay: {
                  ...configuration.privateRelay,
                  enabled,
                  publicationEnabled: enabled,
                },
              })
            }
          />
          {configuration.privateRelay.enabled ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <NumberField
                  disabled={disabled}
                  label={copy.nodeSettings.privateRelayPortStart}
                  min={1}
                  max={65535}
                  value={configuration.privateRelay.portStart}
                  onChange={(portStart) =>
                    onChange({
                      ...configuration,
                      privateRelay: {
                        ...configuration.privateRelay,
                        portStart,
                      },
                    })
                  }
                />
                <NumberField
                  disabled={disabled}
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
              <p className="text-sm leading-6 text-white/45">
                {copy.nodeSettings.privateRelayPortRangeHelp}
              </p>
            </>
          ) : null}
          {!configuration.privateRelay.enabled &&
          configuration.privateRelay.discoveryEnabled ? (
            <p className="rounded-2xl border border-cyan-200/15 bg-cyan-300/10 px-3 py-2 text-sm leading-6 text-cyan-50/75">
              {copy.nodeSettings.privateRelayDiscoveryOnlyBody}
            </p>
          ) : null}
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
              manualRelayMultiaddrs: event.target.value.split(/\r?\n/),
            })
          }
          disabled={disabled}
          className="min-h-24 w-full resize-y rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-45"
          placeholder="/dns4/relay.example.com/tcp/4100/p2p/12D3KooW..."
          autoComplete="off"
        />
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

function TextField({
  disabled,
  label,
  onChange,
  placeholder,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-white/35">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        type="text"
        className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-cyan-300/60 disabled:cursor-not-allowed disabled:opacity-45"
        placeholder={placeholder}
        autoComplete="off"
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
