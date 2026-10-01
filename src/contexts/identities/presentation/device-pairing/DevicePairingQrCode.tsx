import QRCode from 'qrcode';
import { type ReactElement, useEffect, useState } from 'react';

import type { DevicePairingCode } from '../../domain/value-objects/DevicePairingCode';

export function DevicePairingQrCode({
  code,
  label,
}: {
  code: DevicePairingCode;
  label: string;
}): ReactElement {
  const [source, setSource] = useState('');

  useEffect(() => {
    let active = true;

    void QRCode.toDataURL(code.valueOf(), {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    }).then((value) => {
      if (active) setSource(value);
    });

    return () => {
      active = false;
    };
  }, [code]);

  return source ? (
    <img
      alt={label}
      className="mx-auto aspect-square w-full max-w-72 rounded-xl bg-white p-3"
      src={source}
    />
  ) : (
    <div className="mx-auto aspect-square w-full max-w-72 animate-pulse rounded-xl bg-white/10" />
  );
}
