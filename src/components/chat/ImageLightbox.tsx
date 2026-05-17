import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { copy } from '../../i18n/en';
import { cx } from '../../utils/classNameHelper';

export type LightboxImage = {
  alt: string;
  filename: string;
  url: string;
};

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  onClose: () => void;
}

export function ImageLightbox({
  images,
  initialIndex,
  onClose,
}: ImageLightboxProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const activeImage = images[activeIndex];
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex < images.length - 1;

  useEffect(() => {
    setActiveIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    setZoom(1);
  }, [activeIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();

      if (event.key === 'ArrowLeft' && hasPrevious)
        setActiveIndex((current) => current - 1);

      if (event.key === 'ArrowRight' && hasNext)
        setActiveIndex((current) => current + 1);
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasNext, hasPrevious, onClose]);

  if (!activeImage) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/92 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden">
        {hasPrevious && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setActiveIndex((current) => current - 1);
            }}
            className="absolute left-0 z-20 grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-3xl font-black text-white transition hover:bg-white/20 sm:left-4"
            aria-label={copy.attachments.previousImage}
          >
            ‹
          </button>
        )}
        <img
          src={activeImage.url}
          alt={activeImage.alt}
          onClick={(event) => event.stopPropagation()}
          onWheel={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setZoom((current) =>
              clamp(current + (event.deltaY < 0 ? 0.18 : -0.18), 1, 4),
            );
          }}
          className={cx(
            'max-h-full max-w-full touch-auto select-none object-contain transition-transform',
            zoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in',
          )}
          style={{ transform: `scale(${zoom})` }}
        />
        {hasNext && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setActiveIndex((current) => current + 1);
            }}
            className="absolute right-0 z-20 grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-3xl font-black text-white transition hover:bg-white/20 sm:right-4"
            aria-label={copy.attachments.nextImage}
          >
            ›
          </button>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-20 flex items-center justify-center gap-3 text-xs font-black text-white/70">
        <span className="max-w-[70vw] truncate rounded-full bg-white/10 px-3 py-2">
          {activeImage.filename}
        </span>
        {images.length > 1 && (
          <span className="rounded-full bg-white/10 px-3 py-2">
            {activeIndex + 1}/{images.length}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
        className={cx(
          'absolute right-4 top-4 z-30 grid h-11 w-11 place-items-center',
          'rounded-2xl bg-white/10 text-2xl font-black text-white transition hover:bg-white/20',
        )}
        aria-label={copy.attachments.closeViewer}
      >
        ×
      </button>
    </div>,
    document.body,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
