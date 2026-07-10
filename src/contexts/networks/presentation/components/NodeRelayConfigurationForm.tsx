import { useState } from 'react';

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
  const requiresPublicHost = needsPublicHost(configuration);
  const [remoteAccessEnabled, setRemoteAccessEnabled] = useState(() =>
    hasRemoteAccessConfiguration(configuration),
  );

  const updateRemoteAccess = (enabled: boolean) => {
    setRemoteAccessEnabled(enabled);

    if (enabled) return;

    onChange({
      ...configuration,
      callsRelay: {},
      privateRelay: {
        ...configuration.privateRelay,
        enabled: false,
        publicationEnabled: false,
        portEnd: undefined,
        portStart: undefined,
      },
      publicHost: '',
      publicNetwork: { enabled: false },
    });
  };

  return (
    <div className={cx('grid gap-8', className)}>
      <section>
        <RelaySectionHeader
          title={copy.nodeSettings.publicAccessTitle}
          body={copy.nodeSettings.publicAccessBody}
        />
        <SwitchField
          body={copy.nodeSettings.remoteAccessBody}
          checked={remoteAccessEnabled}
          disabled={disabled}
          label={copy.nodeSettings.remoteAccess}
          onChange={updateRemoteAccess}
        />
        {remoteAccessEnabled ? (
          <div className="grid gap-5 border-l-2 border-cyan-300/20 pl-4">
            <TextField
              body={copy.nodeSettings.relayPublicHostBody}
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
            {requiresPublicHost ? (
              <p className="border-l-2 border-amber-300/60 pl-3 text-sm leading-6 text-amber-50/80">
                {copy.nodeSettings.relayPublicHostRequiredWarning}
              </p>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField
                body={copy.nodeSettings.callsRelayPortBody}
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
                body={copy.nodeSettings.publicNetworkPortBody}
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
            <SwitchField
              body={copy.nodeSettings.privateRelayEnabledBody}
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
              <div className="grid gap-3">
                <div className="grid gap-4 sm:grid-cols-2">
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
                        privateRelay: {
                          ...configuration.privateRelay,
                          portEnd,
                        },
                      })
                    }
                  />
                </div>
                <p className="text-sm leading-6 text-white/45">
                  {copy.nodeSettings.privateRelayPortRangeHelp}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="border-t border-white/10 pt-7">
        <RelaySectionHeader
          title={copy.nodeSettings.privateRelayTitle}
          body={copy.nodeSettings.privateRelayBody}
        />
        <div className="grid gap-4">
          <SwitchField
            body={copy.nodeSettings.privateRelayDiscoverRecordsBody}
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
          {!configuration.privateRelay.enabled &&
          configuration.privateRelay.discoveryEnabled ? (
            <p className="text-sm leading-6 text-cyan-50/65">
              {copy.nodeSettings.privateRelayDiscoveryOnlyBody}
            </p>
          ) : null}
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-2">
              <div>
                <div className="text-sm font-black text-white/75">
                  {copy.nodeSettings.manualRelayMultiaddrs}
                </div>
                <p className="mt-1 text-sm leading-6 text-white/45">
                  {copy.nodeSettings.manualRelayMultiaddrsBody}
                </p>
              </div>
              <ChevronIcon />
            </summary>
            <div className="pt-3">
              <textarea
                value={configuration.manualRelayMultiaddrs.join('\n')}
                onChange={(event) =>
                  onChange({
                    ...configuration,
                    manualRelayMultiaddrs: event.target.value.split(/\r?\n/),
                  })
                }
                disabled={disabled}
                className="ui-field-control min-h-24 resize-y px-4 py-3 text-sm placeholder:text-white/30"
                placeholder="/dns4/relay.example.com/tcp/4100/p2p/12D3KooW..."
                autoComplete="off"
              />
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}

function hasRemoteAccessConfiguration(
  configuration: NodeRelayConfiguration,
): boolean {
  return Boolean(
    configuration.publicHost?.trim() ||
    configuration.callsRelay.port ||
    configuration.publicNetwork.enabled ||
    configuration.privateRelay.enabled,
  );
}

function RelaySectionHeader({ body, title }: { body: string; title: string }) {
  return (
    <div className="mb-3">
      <div className="text-base font-black text-white/85">{title}</div>
      <p className="mt-1 text-sm leading-6 text-white/50">{body}</p>
    </div>
  );
}

function NumberField({
  body,
  disabled,
  label,
  max,
  min,
  onChange,
  value,
}: {
  body?: string;
  disabled?: boolean;
  label: string;
  max: number;
  min: number;
  onChange: (value: number | undefined) => void;
  value?: number;
}) {
  return (
    <label className="flex h-full flex-col">
      <span className="mb-1 block text-sm font-black text-white/70">
        {label}
      </span>
      {body ? (
        <span className="mb-2 block text-xs leading-5 text-white/40 sm:min-h-10">
          {body}
        </span>
      ) : null}
      <input
        value={value ?? ''}
        onChange={(event) => onChange(toOptionalPort(event.target.value))}
        disabled={disabled}
        min={min}
        max={max}
        type="number"
        inputMode="numeric"
        className="ui-field-control mt-auto px-4 py-3 text-sm placeholder:text-white/30"
      />
    </label>
  );
}

function TextField({
  body,
  disabled,
  label,
  onChange,
  placeholder,
  value,
}: {
  body?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black text-white/70">
        {label}
      </span>
      {body ? (
        <span className="mb-2 block max-w-2xl text-xs leading-5 text-white/40">
          {body}
        </span>
      ) : null}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        type="text"
        className="ui-field-control px-4 py-3 text-sm placeholder:text-white/30"
        placeholder={placeholder}
        autoComplete="off"
      />
    </label>
  );
}

function SwitchField({
  body,
  checked,
  disabled,
  label,
  onChange,
}: {
  body: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-4 text-sm text-white/75">
      <span className="min-w-0">
        <span className="block font-black">{label}</span>
        <span className="mt-1 block text-xs font-normal leading-5 text-white/40">
          {body}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        aria-hidden="true"
        className={cx(
          'relative h-6 w-11 shrink-0 rounded-full border transition',
          checked
            ? 'border-cyan-200/35 bg-cyan-400/75'
            : 'border-white/12 bg-white/10',
          disabled && 'opacity-45',
        )}
      >
        <span
          className={cx(
            'absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm transition',
            checked ? 'left-[1.3rem]' : 'left-0.5',
          )}
        />
      </span>
    </label>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 shrink-0 text-white/40 transition group-open:rotate-180"
    >
      <path
        d="m7 10 5 5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function toOptionalPort(value: string): number | undefined {
  if (!value.trim()) return undefined;

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined;

  return port;
}

function needsPublicHost(configuration: NodeRelayConfiguration): boolean {
  const publicHost = configuration.publicHost?.trim() ?? '';

  if (publicHost) return false;

  return (
    configuration.privateRelay.enabled ||
    configuration.callsRelay.port !== undefined ||
    configuration.publicNetwork.enabled ||
    configuration.publicNetwork.port !== undefined
  );
}
