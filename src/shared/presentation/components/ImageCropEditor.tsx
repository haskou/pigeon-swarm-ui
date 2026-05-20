import type { CSSProperties, PointerEvent } from 'react';

import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { decompressFrames, parseGIF } from 'gifuct-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { copy } from '../i18n/copy';

type ImageCropShape = 'avatar' | 'banner';

type ImageCropEditorProps = {
  file: File;
  onApply: (file: File, previewUrl: string) => void;
  onClose: () => void;
  shape: ImageCropShape;
};

type DragState = {
  offsetX: number;
  offsetY: number;
  pointerId: number;
  startX: number;
  startY: number;
};

type GifFrameSnapshot = {
  dims: {
    height: number;
    left: number;
    top: number;
    width: number;
  };
  disposalType: number;
  restoreData?: ImageData;
};

const cropPresets: Record<
  ImageCropShape,
  { aspectClass: string; height: number; label: string; width: number }
> = {
  avatar: {
    aspectClass: 'aspect-square',
    height: 512,
    label: copy.imageEditor.avatar,
    width: 512,
  },
  banner: {
    aspectClass: 'aspect-[3/1]',
    height: 533,
    label: copy.imageEditor.banner,
    width: 1600,
  },
};

export function ImageCropEditor({
  file,
  onApply,
  onClose,
  shape,
}: ImageCropEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cropFrameRef = useRef<HTMLDivElement | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [applying, setApplying] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef<DragState | null>(null);
  const preset = cropPresets[shape];
  const outputSize = useMemo(
    () => ({ height: preset.height, width: preset.width }),
    [preset.height, preset.width],
  );
  const animatedGif = isGifFile(file);
  const gifPreviewStyle = useMemo(
    () =>
      image
        ? gifPreviewImageStyle(image, {
            offsetX,
            offsetY,
            outputHeight: outputSize.height,
            outputWidth: outputSize.width,
            zoom,
          })
        : undefined,
    [image, offsetX, offsetY, outputSize.height, outputSize.width, zoom],
  );

  useEffect(() => {
    const nextUrl = URL.createObjectURL(file);
    const nextImage = new Image();

    setImage(null);
    setImageUrl(nextUrl);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = nextUrl;

    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;

    drawCroppedImage(canvasRef.current, image, {
      offsetX,
      offsetY,
      outputHeight: outputSize.height,
      outputWidth: outputSize.width,
      zoom,
    });
  }, [image, offsetX, offsetY, outputSize.height, outputSize.width, zoom]);

  useEffect(() => {
    const cropFrame = cropFrameRef.current;

    if (!cropFrame || !image) return;

    const zoomWithWheel = (event: WheelEvent) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      const nextZoomStep = direction * 0.12;

      setZoom((current) => clampZoom(current + nextZoomStep));
    };

    cropFrame.addEventListener('wheel', zoomWithWheel, { passive: false });

    return () => cropFrame.removeEventListener('wheel', zoomWithWheel);
  }, [image]);

  const applyCrop = async () => {
    if (!image || applying) return;

    setApplying(true);
    try {
      const cropOptions = {
        offsetX,
        offsetY,
        outputHeight: outputSize.height,
        outputWidth: outputSize.width,
        zoom,
      };
      const blob = animatedGif
        ? await cropAnimatedGif(file, cropOptions)
        : await cropStaticImage(image, cropOptions);
      const croppedFile = new File(
        [blob],
        outputFilename(file.name, shape, blob),
        {
          type: blob.type,
        },
      );
      const previewUrl = URL.createObjectURL(blob);

      onApply(croppedFile, previewUrl);
      onClose();
    } finally {
      setApplying(false);
    }
  };
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!image) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      offsetX,
      offsetY,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setDragging(true);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId || !image) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const deltaXPercent =
      ((event.clientX - dragState.startX) / bounds.width) * 100;
    const deltaYPercent =
      ((event.clientY - dragState.startY) / bounds.height) * 100;

    setOffsetX(clampOffset(dragState.offsetX + deltaXPercent));
    setOffsetY(clampOffset(dragState.offsetY + deltaYPercent));
  };
  const stopDrag = (event: PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;

    if (dragState?.pointerId === event.pointerId) {
      dragStateRef.current = null;
      setDragging(false);
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-[130] grid place-items-stretch bg-black/70 p-0 text-white backdrop-blur-xl sm:place-items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0"
        onClick={onClose}
        aria-label={copy.dialog.close}
      />
      <section className="glass-panel-strong relative z-10 flex max-h-screen w-full max-w-3xl flex-col overflow-hidden rounded-none p-5 shadow-2xl shadow-black/50 sm:max-h-[90vh] sm:rounded-2xl sm:p-6">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-xl font-black">{copy.imageEditor.title}</h2>
            <p className="mt-1 text-sm text-white/50">{preset.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-black text-white/75"
            aria-label={copy.dialog.close}
          >
            x
          </button>
        </header>

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl">
            <div
              ref={cropFrameRef}
              className={`relative ${preset.aspectClass} touch-none overflow-hidden rounded-2xl border border-white/10 bg-black/40 ${
                dragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              onPointerDown={startDrag}
              onPointerMove={moveDrag}
              onPointerCancel={stopDrag}
              onPointerUp={stopDrag}
            >
              {animatedGif && imageUrl && image && gifPreviewStyle ? (
                <img
                  src={imageUrl}
                  alt=""
                  className="pointer-events-none absolute max-w-none select-none"
                  style={gifPreviewStyle}
                />
              ) : (
                <canvas ref={canvasRef} className="h-full w-full" />
              )}
              {!image && imageUrl && (
                <div className="absolute inset-0 grid place-items-center text-sm text-white/50">
                  {copy.app.loading}
                </div>
              )}
            </div>

            <div className="mt-5 grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <ImageSlider
                label={copy.imageEditor.zoom}
                max={4}
                min={1}
                onChange={setZoom}
                step={0.01}
                value={zoom}
              />
              <p className="text-xs font-bold leading-5 text-white/45">
                {copy.imageEditor.dragHelp}
              </p>
            </div>
          </div>
        </div>

        <footer className="mt-5 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setOffsetX(0);
              setOffsetY(0);
            }}
            className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
          >
            {copy.imageEditor.reset}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/15"
          >
            {copy.dialog.cancel}
          </button>
          <button
            type="button"
            disabled={!image || applying}
            onClick={() => void applyCrop()}
            className="rounded-2xl bg-fuchsia-500 px-4 py-3 text-sm font-black text-white shadow-xl shadow-fuchsia-950/25 transition hover:bg-fuchsia-400 disabled:cursor-wait disabled:opacity-60"
          >
            {applying ? copy.app.loading : copy.imageEditor.apply}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function ImageSlider({
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
  return (
    <label className="grid gap-2 text-xs font-black uppercase tracking-[0.14em] text-white/45">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-fuchsia-400"
      />
    </label>
  );
}

function drawCroppedImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  options: {
    offsetX: number;
    offsetY: number;
    outputHeight: number;
    outputWidth: number;
    zoom: number;
  },
): void {
  drawCroppedSource(
    canvas,
    image,
    image.naturalWidth,
    image.naturalHeight,
    options,
  );
}

function drawCroppedSource(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  options: {
    offsetX: number;
    offsetY: number;
    outputHeight: number;
    outputWidth: number;
    zoom: number;
  },
): void {
  canvas.width = options.outputWidth;
  canvas.height = options.outputHeight;

  const context = canvas.getContext('2d');

  if (!context) return;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#070914';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const baseScale = Math.max(
    options.outputWidth / sourceWidth,
    options.outputHeight / sourceHeight,
  );
  const scale = baseScale * options.zoom;
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const maxOffsetX = Math.max(0, (drawWidth - options.outputWidth) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - options.outputHeight) / 2);
  const offsetXPixels = (options.offsetX / 100) * maxOffsetX;
  const offsetYPixels = (options.offsetY / 100) * maxOffsetY;
  const drawX = (options.outputWidth - drawWidth) / 2 + offsetXPixels;
  const drawY = (options.outputHeight - drawHeight) / 2 + offsetYPixels;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, drawX, drawY, drawWidth, drawHeight);
}

function gifPreviewImageStyle(
  image: HTMLImageElement,
  options: {
    offsetX: number;
    offsetY: number;
    outputHeight: number;
    outputWidth: number;
    zoom: number;
  },
): CSSProperties {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const baseScale = Math.max(
    options.outputWidth / sourceWidth,
    options.outputHeight / sourceHeight,
  );
  const scale = baseScale * options.zoom;
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const maxOffsetX = Math.max(0, (drawWidth - options.outputWidth) / 2);
  const maxOffsetY = Math.max(0, (drawHeight - options.outputHeight) / 2);
  const offsetXPixels = (options.offsetX / 100) * maxOffsetX;
  const offsetYPixels = (options.offsetY / 100) * maxOffsetY;
  const drawX = (options.outputWidth - drawWidth) / 2 + offsetXPixels;
  const drawY = (options.outputHeight - drawHeight) / 2 + offsetYPixels;

  return {
    height: `${(drawHeight / options.outputHeight) * 100}%`,
    left: `${(drawX / options.outputWidth) * 100}%`,
    top: `${(drawY / options.outputHeight) * 100}%`,
    width: `${(drawWidth / options.outputWidth) * 100}%`,
  };
}

async function cropStaticImage(
  image: HTMLImageElement,
  options: {
    offsetX: number;
    offsetY: number;
    outputHeight: number;
    outputWidth: number;
    zoom: number;
  },
): Promise<Blob> {
  const canvas = document.createElement('canvas');

  drawCroppedImage(canvas, image, options);

  return await canvasToBlob(canvas, 'image/jpeg', 0.9);
}

async function cropAnimatedGif(
  file: File,
  options: {
    offsetX: number;
    offsetY: number;
    outputHeight: number;
    outputWidth: number;
    zoom: number;
  },
): Promise<Blob> {
  const parsed = parseGIF(await file.arrayBuffer());
  const frames = decompressFrames(parsed, true);
  const sourceCanvas = document.createElement('canvas');
  const outputCanvas = document.createElement('canvas');
  const sourceContext = sourceCanvas.getContext('2d');
  const outputContext = outputCanvas.getContext('2d');
  const encoder = GIFEncoder();
  let previousFrame: GifFrameSnapshot | null = null;

  if (!sourceContext || !outputContext) {
    throw new Error('GIF crop failed');
  }

  sourceCanvas.width = parsed.lsd.width;
  sourceCanvas.height = parsed.lsd.height;
  outputCanvas.width = options.outputWidth;
  outputCanvas.height = options.outputHeight;

  for (const [index, frame] of frames.entries()) {
    applyGifDisposal(sourceContext, previousFrame);

    const restoreData =
      frame.disposalType === 3
        ? sourceContext.getImageData(
            0,
            0,
            sourceCanvas.width,
            sourceCanvas.height,
          )
        : undefined;

    compositeGifPatch(sourceContext, frame.patch, frame.dims);
    drawCroppedSource(
      outputCanvas,
      sourceCanvas,
      sourceCanvas.width,
      sourceCanvas.height,
      options,
    );

    const rgba = outputContext.getImageData(
      0,
      0,
      outputCanvas.width,
      outputCanvas.height,
    ).data;
    const palette = quantize(rgba, 256, { format: 'rgb565' });
    const indexed = applyPalette(rgba, palette, 'rgb565');

    encoder.writeFrame(indexed, outputCanvas.width, outputCanvas.height, {
      delay: Math.max(20, frame.delay || 100),
      palette,
      repeat: index === 0 ? 0 : undefined,
    });

    previousFrame = {
      dims: frame.dims,
      disposalType: frame.disposalType,
      restoreData,
    };
  }

  encoder.finish();

  return new Blob([bytesToBlobPart(encoder.bytes())], { type: 'image/gif' });
}

function applyGifDisposal(
  context: CanvasRenderingContext2D,
  previousFrame: GifFrameSnapshot | null,
): void {
  if (!previousFrame) return;

  if (previousFrame.disposalType === 2) {
    context.clearRect(
      previousFrame.dims.left,
      previousFrame.dims.top,
      previousFrame.dims.width,
      previousFrame.dims.height,
    );
  }

  if (previousFrame.disposalType === 3 && previousFrame.restoreData) {
    context.putImageData(previousFrame.restoreData, 0, 0);
  }
}

function compositeGifPatch(
  context: CanvasRenderingContext2D,
  patch: Uint8ClampedArray,
  dims: { height: number; left: number; top: number; width: number },
): void {
  const imageData = context.getImageData(
    dims.left,
    dims.top,
    dims.width,
    dims.height,
  );
  const output = imageData.data;

  for (let index = 0; index < patch.length; index += 4) {
    if (patch[index + 3] === 0) continue;

    output[index] = patch[index];
    output[index + 1] = patch[index + 1];
    output[index + 2] = patch[index + 2];
    output[index + 3] = patch[index + 3];
  }

  context.putImageData(imageData, dims.left, dims.top);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Image export failed'));
      },
      type,
      quality,
    );
  });
}

function isGifFile(file: File): boolean {
  return file.type === 'image/gif' || /\.gif$/i.test(file.name);
}

function bytesToBlobPart(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function clampOffset(value: number): number {
  return Math.max(-100, Math.min(100, value));
}

function clampZoom(value: number): number {
  return Math.max(1, Math.min(4, value));
}

function outputFilename(
  filename: string,
  shape: ImageCropShape,
  blob: Blob,
): string {
  const basename = filename.replace(/\.[^.]+$/, '') || shape;
  const extension = blob.type === 'image/gif' ? 'gif' : 'jpg';

  return `${basename}-${shape}.${extension}`;
}
