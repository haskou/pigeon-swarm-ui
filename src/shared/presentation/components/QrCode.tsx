import QRCode from 'qrcode';
import { type ReactElement, useEffect, useState } from 'react';

export function QrCode({
  label,
  value,
}: {
  label: string;
  value: string;
}): ReactElement {
  const [source, setSource] = useState('');

  useEffect(() => {
    let active = true;

    void QRCode.toDataURL(value, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320,
    }).then((dataUrl) => {
      if (active) setSource(dataUrl);
    });

    return () => {
      active = false;
    };
  }, [value]);

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
