import { useState } from 'react';

import type { NodeRelayConfigurationViewModel } from '../view-models/NodeRelayConfigurationViewModel';

import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import {
  hasRemoteAccessConfiguration,
  needsPublicHost,
} from './relay/nodeRelayConfigurationState';
import { RelayChevronIcon } from './relay/RelayChevronIcon';
import { RelayNumberField } from './relay/RelayNumberField';
import { RelaySectionHeader } from './relay/RelaySectionHeader';
import { RelaySwitchField } from './relay/RelaySwitchField';
import { RelayTextField } from './relay/RelayTextField';

export function NodeRelayConfigurationForm({
  className,
  configuration,
  disabled = false,
  onChange,
}: {
  className?: string;
  configuration: NodeRelayConfigurationViewModel;
  disabled?: boolean;
  onChange: (configuration: NodeRelayConfigurationViewModel) => void;
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
        portEnd: undefined,
        portStart: undefined,
        publicationEnabled: false,
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
        <RelaySwitchField
          body={copy.nodeSettings.remoteAccessBody}
          checked={remoteAccessEnabled}
          disabled={disabled}
          label={copy.nodeSettings.remoteAccess}
          onChange={updateRemoteAccess}
        />
        {remoteAccessEnabled ? (
          <div className="grid gap-5 border-l-2 border-cyan-300/20 pl-4">
            <RelayTextField
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
              <RelayNumberField
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
              <RelayNumberField
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
            <RelaySwitchField
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
                  <RelayNumberField
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
                  <RelayNumberField
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
          <RelaySwitchField
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
              <RelayChevronIcon />
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
