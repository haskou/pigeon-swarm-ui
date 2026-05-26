import { useEffect, useRef } from 'react';

export function VideoPreview({
  fit = 'cover',
  label,
  muted,
  stream,
}: {
  fit?: 'contain' | 'cover';
  label: string;
  muted: boolean;
  stream: MediaStream;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    if (video.srcObject !== stream) video.srcObject = stream;
    void video.play().catch(() => undefined);

    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      aria-label={label}
      autoPlay
      muted={muted}
      playsInline
      className={
        fit === 'contain'
          ? 'block h-full w-full object-contain'
          : 'block h-full w-full object-cover'
      }
    />
  );
}
