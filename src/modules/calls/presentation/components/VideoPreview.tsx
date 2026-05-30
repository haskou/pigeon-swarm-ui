import { useEffect, useRef } from 'react';

export function VideoPreview({
  fit = 'cover',
  label,
  muted,
  onAspectRatioChange,
  stream,
}: {
  fit?: 'contain' | 'cover';
  label: string;
  muted: boolean;
  onAspectRatioChange?: (aspectRatio: number) => void;
  stream: MediaStream;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) return;

    if (video.srcObject !== stream) video.srcObject = stream;
    const updateAspectRatio = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        onAspectRatioChange?.(video.videoWidth / video.videoHeight);
      }
    };

    video.addEventListener('loadedmetadata', updateAspectRatio);
    updateAspectRatio();
    void video.play().catch(() => undefined);

    return () => {
      video.removeEventListener('loadedmetadata', updateAspectRatio);
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [onAspectRatioChange, stream]);

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
