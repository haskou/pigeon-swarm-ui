import type { PointerEvent } from 'react';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { cx } from '../../../../shared/presentation/cx';
import { useCloseOnEscape } from '../../../../shared/presentation/hooks/useCloseOnEscape';
import { useCloseTransition } from '../../../../shared/presentation/hooks/useCloseTransition';
import type { MessageAttachment } from '../../../../shared/domain/pigeonResources.types';

export type LightboxImage = {
  alt: string;
  attachment?: MessageAttachment;
  filename: string;
  url: string;
};

type PointerPosition = {
  x: number;
  y: number;
};

type PanOffset = {
  x: number;
  y: number;
};

type PanGesture = {
  pointerId: number;
  startPan: PanOffset;
  startX: number;
  startY: number;
};

type PinchGesture = {
  startCenter: PointerPosition;
  startDistance: number;
  startPan: PanOffset;
  startZoom: number;
};

type SwipeDirection = 'horizontal' | 'vertical';

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  loadImage?: (attachment: MessageAttachment) => Promise<string>;
  onClose: () => void;
}

export function ImageLightbox({
  images,
  initialIndex,
  loadImage,
  onClose,
}: ImageLightboxProps) {
  const { close, state: transitionState } = useCloseTransition(onClose, 160);

  useCloseOnEscape(close);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PanOffset>({ x: 0, y: 0 });
  const [swipeOffset, setSwipeOffset] = useState<PanOffset>({ x: 0, y: 0 });
  const [swipeDirection, setSwipeDirection] =
    useState<SwipeDirection | null>(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [originalUrls, setOriginalUrls] = useState<Record<number, string>>({});
  const originalUrlsRef = useRef<Record<number, string>>({});
  const [touchGestureActive, setTouchGestureActive] = useState(false);
  const pointerPositionsRef = useRef<Map<number, PointerPosition>>(new Map());
  const panRef = useRef<PanGesture | null>(null);
  const pinchRef = useRef<PinchGesture | null>(null);
  const swipeRef = useRef<{
    dragging: boolean;
    direction: SwipeDirection | null;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);
  const activeImage = images[activeIndex];
  const activeImageUrl = originalUrls[activeIndex] ?? activeImage?.url;
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
    let cancelled = false;
    const attachment = activeImage?.attachment;

    if (!attachment || !loadImage || originalUrls[activeIndex]) {
      setLoadingOriginal(false);

      return undefined;
    }

    setLoadingOriginal(true);
    loadImage(attachment)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);

          return;
        }

        setOriginalUrls((current) => {
          const next = { ...current, [activeIndex]: url };

          originalUrlsRef.current = next;

          return next;
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingOriginal(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeImage?.attachment, activeIndex, loadImage, originalUrls]);

  useEffect(
    () => () => {
      Object.values(originalUrlsRef.current).forEach((url) =>
        URL.revokeObjectURL(url),
      );
    },
    [],
  );

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSwipeOffset({ x: 0, y: 0 });
    setSwipeDirection(null);
    setTouchGestureActive(false);
    pointerPositionsRef.current.clear();
    panRef.current = null;
    pinchRef.current = null;
    swipeRef.current = null;
  }, [activeIndex]);

  useEffect(() => {
    if (zoom <= 1) setPan({ x: 0, y: 0 });
  }, [zoom]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && hasPrevious) goToPrevious();

      if (event.key === 'ArrowRight' && hasNext) goToNext();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasNext, hasPrevious]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'touch') return;

    pointerPositionsRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    setTouchGestureActive(true);
    event.currentTarget.setPointerCapture(event.pointerId);

    if (pointerPositionsRef.current.size >= 2) {
      const [first, second] = getActivePointers(pointerPositionsRef.current);

      pinchRef.current = {
        startCenter: getPointerCenter(first, second),
        startDistance: Math.max(getPointerDistance(first, second), 1),
        startPan: pan,
        startZoom: zoom,
      };
      panRef.current = null;
      swipeRef.current = null;
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    if (zoom > 1) {
      panRef.current = {
        pointerId: event.pointerId,
        startPan: pan,
        startX: event.clientX,
        startY: event.clientY,
      };
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    swipeRef.current = {
      dragging: false,
      direction: null,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
  };
  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType === 'touch' &&
      pointerPositionsRef.current.has(event.pointerId)
    ) {
      pointerPositionsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
    }

    if (pinchRef.current && pointerPositionsRef.current.size >= 2) {
      const [first, second] = getActivePointers(pointerPositionsRef.current);
      const center = getPointerCenter(first, second);
      const nextZoom = clamp(
        pinchRef.current.startZoom *
          (getPointerDistance(first, second) / pinchRef.current.startDistance),
        1,
        4,
      );

      setZoom(nextZoom);
      setPan(
        nextZoom <= 1
          ? { x: 0, y: 0 }
          : {
              x:
                pinchRef.current.startPan.x +
                center.x -
                pinchRef.current.startCenter.x,
              y:
                pinchRef.current.startPan.y +
                center.y -
                pinchRef.current.startCenter.y,
            },
      );
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    const panGesture = panRef.current;

    if (panGesture && panGesture.pointerId === event.pointerId && zoom > 1) {
      setPan({
        x: panGesture.startPan.x + event.clientX - panGesture.startX,
        y: panGesture.startPan.y + event.clientY - panGesture.startY,
      });
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    const swipe = swipeRef.current;

    if (!swipe || swipe.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!swipe.direction && Math.max(absX, absY) > 12) {
      swipe.direction = absX > absY ? 'horizontal' : 'vertical';
      swipe.dragging = true;
      setSwipeDirection(swipe.direction);
    }

    if (swipe.direction === 'horizontal') {
      const boundedDeltaX =
        (deltaX > 0 && !hasPrevious) || (deltaX < 0 && !hasNext)
          ? deltaX * 0.28
          : deltaX;

      setSwipeOffset({ x: boundedDeltaX, y: 0 });
      event.preventDefault();
      event.stopPropagation();

      return;
    }

    if (swipe.direction === 'vertical') {
      setSwipeOffset({ x: 0, y: deltaY });
      event.preventDefault();
      event.stopPropagation();
    }
  };
  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      pointerPositionsRef.current.delete(event.pointerId);
      if (pointerPositionsRef.current.size < 2) pinchRef.current = null;
      if (pointerPositionsRef.current.size === 0) setTouchGestureActive(false);
    }

    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;

      return;
    }

    const swipe = swipeRef.current;

    if (!swipe || swipe.pointerId !== event.pointerId) return;

    swipeRef.current = null;

    if (!swipe.dragging) return;

    event.preventDefault();
    event.stopPropagation();

    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    const horizontalThreshold = Math.min(96, window.innerWidth * 0.18);
    const verticalThreshold = Math.min(120, window.innerHeight * 0.16);

    setSwipeOffset({ x: 0, y: 0 });
    setSwipeDirection(null);

    if (
      swipe.direction === 'vertical' &&
      Math.abs(deltaY) >= verticalThreshold
    ) {
      close();

      return;
    }

    if (swipe.direction !== 'horizontal') return;

    if (deltaX <= -horizontalThreshold && hasNext) goToNext();

    if (deltaX >= horizontalThreshold && hasPrevious) goToPrevious();
  };
  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      pointerPositionsRef.current.delete(event.pointerId);
      if (pointerPositionsRef.current.size < 2) pinchRef.current = null;
      if (pointerPositionsRef.current.size === 0) setTouchGestureActive(false);
    }

    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;

    const swipe = swipeRef.current;

    if (swipe?.pointerId === event.pointerId) {
      swipeRef.current = null;
      setSwipeOffset({ x: 0, y: 0 });
      setSwipeDirection(null);
    }
  };

  if (!activeImage) return null;

  return createPortal(
    <div
      className="image-lightbox-scrim fixed inset-0 z-[1000] grid place-items-center bg-black/92 p-4 backdrop-blur-xl"
      data-state={transitionState}
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="relative z-10 flex h-full w-full touch-none items-center justify-center overflow-hidden"
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
          src={activeImageUrl}
          alt={activeImage.alt}
          onClick={(event) => event.stopPropagation()}
          onWheel={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setZoom((current) => {
              const nextZoom = clamp(
                current + (event.deltaY < 0 ? 0.18 : -0.18),
                1,
                4,
              );

              if (nextZoom <= 1) setPan({ x: 0, y: 0 });

              return nextZoom;
            });
          }}
          className={cx(
            'image-lightbox-media max-h-full max-w-full touch-none select-none object-contain',
            touchGestureActive
              ? ''
              : 'transition-transform duration-200 ease-out',
            zoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in',
          )}
          data-state={transitionState}
          style={{
            opacity:
              swipeDirection === 'vertical'
                ? Math.max(
                    0.45,
                    1 - Math.abs(swipeOffset.y) / window.innerHeight,
                  )
                : undefined,
            transform: `translate3d(${pan.x + swipeOffset.x}px, ${pan.y + swipeOffset.y}px, 0) scale(${zoom})`,
          }}
        />
        {loadingOriginal && (
          <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/70 px-3 py-2 text-xs font-black text-white/75">
            {copy.composer.downloadingAttachment}
          </div>
        )}
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
            close();
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

function getActivePointers(
  positions: Map<number, PointerPosition>,
): [PointerPosition, PointerPosition] {
  const pointers = Array.from(positions.values());

  return [
    pointers[0] ?? { x: 0, y: 0 },
    pointers[1] ?? { x: 0, y: 0 },
  ];
}

function getPointerCenter(
  first: PointerPosition,
  second: PointerPosition,
): PointerPosition {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function getPointerDistance(
  first: PointerPosition,
  second: PointerPosition,
): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
