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

    video.srcObject = stream;
    void video.play().catch(() => undefined);

    return () => {
      video.srcObject = null;
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
          ? 'h-full w-full object-contain'
          : 'h-full w-full object-cover'
      }
    />
  );
}
