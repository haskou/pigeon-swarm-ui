import { useEffect, useState } from 'react';

import type { CallMicrophoneDevice } from '../../infrastructure/media/CallMicrophoneDevice';
import type { CallSession } from '../view-models/CallSession';

import { cx } from '../../../../shared/presentation/cx';
import { copy } from '../../../../shared/presentation/i18n/copy';
import { listCallMicrophones } from '../../infrastructure/media/listCallMicrophones';
import { microphoneErrorText } from './microphoneErrorText';

export function MicrophoneDevicePicker({
  call,
  compact = false,
  onRetryMicrophone,
}: {
  call: CallSession;
  compact?: boolean;
  onRetryMicrophone: (deviceId?: string) => void;
}) {
  const [devices, setDevices] = useState<CallMicrophoneDevice[]>([]);

  // Labels and ids only appear once the microphone is allowed.
  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    let mounted = true;
    const refresh = () => {
      void listCallMicrophones(mediaDevices).then((listed) => {
        if (mounted) setDevices(listed);
      });
    };

    refresh();
    mediaDevices?.addEventListener('devicechange', refresh);

    return () => {
      mounted = false;
      mediaDevices?.removeEventListener('devicechange', refresh);
    };
  }, [call.hasMicrophone]);

  if (devices.length === 0) return null;

  const selectedDeviceId = devices.some(
    (device) => device.deviceId === call.microphoneDeviceId,
  )
    ? call.microphoneDeviceId
    : '';

  return (
    <div className={cx('min-w-0', compact ? 'mt-2' : 'mt-3 max-w-sm')}>
      <label className="block min-w-0">
        <span className="mb-1 block text-[0.65rem] font-black uppercase tracking-[0.12em] text-white/35">
          {copy.calls.microphoneDevice}
        </span>
        <select
          aria-label={copy.calls.microphoneDevice}
          value={selectedDeviceId}
          onChange={(event) => onRetryMicrophone(event.target.value)}
          className="h-9 w-full rounded-xl border border-white/10 bg-white/8 px-3 text-xs font-black text-white outline-none transition hover:bg-white/12 focus:border-emerald-300/60"
        >
          <option value="" className="bg-[#151722]">
            {copy.calls.microphoneDeviceDefault}
          </option>
          {devices.map((device, index) => (
            <option
              key={device.deviceId}
              value={device.deviceId}
              className="bg-[#151722]"
            >
              {device.label || `${copy.calls.microphoneDevice} ${index + 1}`}
            </option>
          ))}
        </select>
      </label>
      {call.hasMicrophone && call.microphoneError ? (
        <p className="mt-1 text-xs leading-snug text-amber-100/75">
          {microphoneErrorText(call.microphoneError)}
        </p>
      ) : null}
    </div>
  );
}
