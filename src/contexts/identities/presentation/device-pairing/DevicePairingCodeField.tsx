import { type ReactElement, useEffect, useRef, useState } from 'react';

import { copy } from '../../../../shared/presentation/i18n/copy';

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorConstructor = new (options: { formats: string[] }) => {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
};

function detectorConstructor(): BarcodeDetectorConstructor | undefined {
  return (
    globalThis as typeof globalThis & {
      BarcodeDetector?: BarcodeDetectorConstructor;
    }
  ).BarcodeDetector;
}

export function DevicePairingCodeField({
  label,
  onChange,
  placeholder,
  testId,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  testId?: string;
  value: string;
}): ReactElement {
  const video = useRef<HTMLVideoElement | null>(null);
  const [scanning, setScanning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const canScan = Boolean(detectorConstructor() && navigator.mediaDevices);
  const canPaste = Boolean(navigator.clipboard?.readText);

  useEffect(
    () => () => stream?.getTracks().forEach((track) => track.stop()),
    [stream],
  );

  useEffect(() => {
    if (!scanning || !stream || !video.current) return undefined;

    const Detector = detectorConstructor();

    if (!Detector) return undefined;

    const detector = new Detector({ formats: ['qr_code'] });
    let active = true;
    let frame = 0;
    const inspect = async () => {
      if (!active || !video.current) return;

      const [result] = await detector.detect(video.current).catch(() => []);

      if (result?.rawValue) {
        onChange(result.rawValue);
        setScanning(false);
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);

        return;
      }

      frame = requestAnimationFrame(() => void inspect());
    };

    frame = requestAnimationFrame(() => void inspect());

    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [onChange, scanning, stream]);

  const startScanning = async () => {
    setProblem(null);

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });

      setStream(nextStream);
      setScanning(true);

      if (video.current) {
        video.current.srcObject = nextStream;
        await video.current.play();
      }
    } catch {
      setProblem(copy.devicePairing.scanFailed);
    }
  };
  const pasteFromClipboard = async () => {
    setProblem(null);

    try {
      onChange(await navigator.clipboard.readText());
    } catch {
      setProblem(copy.devicePairing.pasteFailed);
    }
  };

  return (
    <div className="grid gap-2">
      <label className="text-xs font-black text-white/60">{label}</label>
      <textarea
        aria-label={label}
        className="ui-field-control min-h-24 resize-y px-3 py-2 font-mono text-xs placeholder:text-white/30"
        data-testid={testId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        value={value}
      />
      <div className="flex flex-wrap gap-2">
        {canPaste && (
          <button
            className="ui-button"
            onClick={() => void pasteFromClipboard()}
            type="button"
          >
            {copy.devicePairing.paste}
          </button>
        )}
        {canScan && (
          <button
            className="ui-button"
            onClick={() => void startScanning()}
            type="button"
          >
            {copy.devicePairing.scanQr}
          </button>
        )}
      </div>
      {problem && <p className="text-xs text-rose-200">{problem}</p>}
      <video
        className={
          scanning ? 'aspect-square w-full rounded-xl object-cover' : 'hidden'
        }
        muted
        playsInline
        ref={video}
      />
    </div>
  );
}
