import type { MouseEvent, PointerEvent } from 'react';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { pigeonApplication } from '../../application/applicationContainer';

const STICKER_PREVIEW_DELAY_MS = 260;
const STICKER_PREVIEW_SIZE = 336;
const STICKER_PREVIEW_MARGIN = 16;

type StickerPreviewPosition = {
  x: number;
  y: number;
};

type StickerPressPreviewState = {
  assetCid: string;
  position: StickerPreviewPosition;
};

export function stickerAssetUrl(assetCid: string): string {
  return pigeonApplication.stickerAssetUrl(assetCid);
}

export function useStickerPressPreview(assetCid: string) {
  const timeoutRef = useRef<number | null>(null);
  const previewTriggeredRef = useRef(false);
  const [preview, setPreview] = useState<StickerPressPreviewState | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  const clearTimer = () => {
    if (timeoutRef.current === null) return;

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };

  const closePreview = () => {
    clearTimer();
    setPreview(null);
  };

  const startPreview = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;

    clearTimer();
    previewTriggeredRef.current = false;

    const position = clampStickerPreviewPosition(event.clientX, event.clientY);
    timeoutRef.current = window.setTimeout(() => {
      previewTriggeredRef.current = true;
      setPreview({ assetCid, position });
    }, STICKER_PREVIEW_DELAY_MS);
  };

  const consumePreviewClick = () => {
    const triggered = previewTriggeredRef.current;
    previewTriggeredRef.current = false;

    return triggered;
  };

  return {
    consumePreviewClick,
    previewPortal: preview ? <StickerPressPreview preview={preview} /> : null,
    pressPreviewHandlers: {
      onContextMenu: (event: MouseEvent<HTMLElement>) => {
        if (previewTriggeredRef.current) {
          event.preventDefault();
        }
      },
      onPointerCancel: closePreview,
      onPointerDown: startPreview,
      onPointerLeave: closePreview,
      onPointerUp: closePreview,
    },
  };
}

function StickerPressPreview({
  preview,
}: {
  preview: StickerPressPreviewState;
}) {
  return createPortal(
    <div
      className="pointer-events-none fixed z-[120] grid h-[21rem] w-[21rem] place-items-center rounded-3xl border border-white/15 bg-black/70 p-1.5 shadow-2xl shadow-black/50 backdrop-blur-xl"
      style={{ left: preview.position.x, top: preview.position.y }}
      aria-hidden="true"
    >
      <img
        src={stickerAssetUrl(preview.assetCid)}
        alt=""
        className="max-h-full max-w-full object-contain"
        draggable={false}
      />
    </div>,
    document.body,
  );
}

function clampStickerPreviewPosition(
  pointerX: number,
  pointerY: number,
): StickerPreviewPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const preferredX = pointerX - STICKER_PREVIEW_SIZE / 2;
  const preferredY = pointerY - STICKER_PREVIEW_SIZE - STICKER_PREVIEW_MARGIN;
  const fallbackY = pointerY + STICKER_PREVIEW_MARGIN;

  return {
    x: clamp(
      preferredX,
      STICKER_PREVIEW_MARGIN,
      viewportWidth - STICKER_PREVIEW_SIZE - STICKER_PREVIEW_MARGIN,
    ),
    y: clamp(
      preferredY >= STICKER_PREVIEW_MARGIN ? preferredY : fallbackY,
      STICKER_PREVIEW_MARGIN,
      viewportHeight - STICKER_PREVIEW_SIZE - STICKER_PREVIEW_MARGIN,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;

  return Math.min(Math.max(value, min), max);
}
