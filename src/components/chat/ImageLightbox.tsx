import type { PointerEvent } from 'react';

import { useEffect, useRef, useState } from 'react';
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
  const swipeRef = useRef<{
    dragging: boolean;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const activeImage = images[activeIndex];
  const hasPrevious = activeIndex > 0;
  const hasNext = activeIndex < images.length - 1;
  const goToPrevious = () => {
    setActiveIndex((current) => Math.max(0, current - 1));
  };
  const goToNext = () => {
    setActiveIndex((current) => Math.min(images.length - 1, current + 1));
  };

  useEffect(() => {
    setActiveIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    setZoom(1);
  }, [activeIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();

      if (event.key === 'ArrowLeft' && hasPrevious) goToPrevious();

      if (event.key === 'ArrowRight' && hasNext) goToNext();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasNext, hasPrevious, onClose]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch' || zoom > 1 || images.length < 2) return;

    swipeRef.current = {
      dragging: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;

    if (!swipe || swipe.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;

    if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) {
      swipe.dragging = true;
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;

    if (!swipe || swipe.pointerId !== event.pointerId) return;

    swipeRef.current = null;

    if (!swipe.dragging) return;

    event.preventDefault();
    event.stopPropagation();

    const deltaX = event.clientX - swipe.startX;
    const swipeThreshold = Math.min(96, window.innerWidth * 0.18);

    if (deltaX <= -swipeThreshold && hasNext) goToNext();

    if (deltaX >= swipeThreshold && hasPrevious) goToPrevious();
  };
  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;

    if (swipe?.pointerId === event.pointerId) swipeRef.current = null;
  };

  if (!activeImage) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/92 p-4 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative z-10 flex h-full w-full touch-pan-y items-center justify-center overflow-hidden"
        onPointerCancel={handlePointerCancel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
      >
        {hasPrevious && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              goToPrevious();
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
            'max-h-full max-w-full touch-pan-y select-none object-contain transition-transform',
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
              goToNext();
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
