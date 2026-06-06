import type {
  PublicFileUpload,
  StickerDimensions,
  StickerType,
} from '../../../../shared/domain/pigeonResources.types';

import { AnimatedWebpEncoder } from '../../../../shared/presentation/media/AnimatedWebpEncoder';

const STICKER_MAX_EDGE = 512;
const STICKER_SIZE_LIMITS: Record<StickerType, number> = {
  animated: 64 * 1024,
  static: 512 * 1024,
  video: 256 * 1024,
};

export function stickerTypeFromUpload(upload: PublicFileUpload): StickerType {
  if (upload.contentType.startsWith('video/')) return 'video';

  if (upload.contentType === 'image/gif') return 'animated';

  return 'static';
}

export async function prepareStickerFile(
  file: File,
): Promise<{ dimensions: StickerDimensions; file: File; type: StickerType }> {
  const originalDimensions = await readMediaDimensions(file);
  const type = await stickerTypeFromFile(file);
  const preparedFile = await prepareStickerUploadFile(
    file,
    originalDimensions,
    type,
  );
  const dimensions =
    preparedFile === file
      ? originalDimensions
      : await readMediaDimensions(preparedFile);

  if (dimensionsExceedStickerLimit(dimensions)) {
    throw new Error(
      'Sticker dimensions must be 512x512 or smaller. Animated and video stickers must already fit this size.',
    );
  }

  const maxSizeBytes = STICKER_SIZE_LIMITS[type];

  if (preparedFile.size > maxSizeBytes) {
    throw new Error(
      `Sticker is too large. ${stickerTypeLabel(type)} stickers can be up to ${formatBytes(maxSizeBytes)}.`,
    );
  }

  return {
    dimensions,
    file: preparedFile,
    type,
  };
}

async function stickerTypeFromFile(file: File): Promise<StickerType> {
  if (file.type.startsWith('video/')) return 'video';

  if (isGifFile(file)) {
    return (await new AnimatedWebpEncoder().isAnimatedGif(file))
      ? 'animated'
      : 'static';
  }

  return 'static';
}

function dimensionsExceedStickerLimit(dimensions: StickerDimensions): boolean {
  return (
    dimensions.width > STICKER_MAX_EDGE || dimensions.height > STICKER_MAX_EDGE
  );
}

async function prepareStickerUploadFile(
  file: File,
  dimensions: StickerDimensions,
  type: StickerType,
): Promise<File> {
  if (type === 'static') {
    return await prepareStaticStickerImage(file, dimensions);
  }

  if (type === 'animated' && isGifFile(file)) {
    return await prepareAnimatedStickerGif(file, dimensions);
  }

  return file;
}

async function prepareStaticStickerImage(
  file: File,
  dimensions: StickerDimensions,
): Promise<File> {
  const shouldScale = dimensionsExceedStickerLimit(dimensions);
  const shouldConvert = file.type !== 'image/webp';

  if (!shouldScale && !shouldConvert) return file;

  const scale = shouldScale
    ? Math.min(
        STICKER_MAX_EDGE / dimensions.width,
        STICKER_MAX_EDGE / dimensions.height,
      )
    : 1;
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  if (!context) throw new Error('Sticker could not be resized.');

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, 'image/webp', 0.88);

  return new File([blob], webpFilename(file.name), {
    lastModified: file.lastModified,
    type: 'image/webp',
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Sticker image could not be loaded.'));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  contentType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);

          return;
        }

        reject(new Error('Sticker could not be resized.'));
      },
      contentType,
      quality,
    );
  });
}

async function prepareAnimatedStickerGif(
  file: File,
  dimensions: StickerDimensions,
): Promise<File> {
  const scale = dimensionsExceedStickerLimit(dimensions)
    ? Math.min(
        STICKER_MAX_EDGE / dimensions.width,
        STICKER_MAX_EDGE / dimensions.height,
      )
    : 1;
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));
  const blob = await new AnimatedWebpEncoder().encodeGif(file, {
    drawFrame: ({ outputCanvas, sourceCanvas }) => {
      const context = outputCanvas.getContext('2d');

      if (!context) throw new Error('Sticker could not be converted.');

      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
      context.drawImage(sourceCanvas, 0, 0, width, height);
    },
    outputHeight: height,
    outputWidth: width,
  });

  return new File([blob], webpFilename(file.name), {
    lastModified: file.lastModified,
    type: 'image/webp',
  });
}

function webpFilename(filename: string): string {
  const basename = filename.replace(/\.[^.]+$/, '') || 'sticker';

  return `${basename}.webp`;
}

function isGifFile(file: File): boolean {
  return file.type === 'image/gif' || /\.gif$/i.test(file.name);
}

function stickerTypeLabel(type: StickerType): string {
  if (type === 'animated') return 'Animated';

  if (type === 'video') return 'Video';

  return 'Static';
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1024)} KiB`;
}

async function readMediaDimensions(file: File): Promise<StickerDimensions> {
  if (file.type.startsWith('video/')) return await readVideoDimensions(file);

  return await readImageDimensions(file);
}

function readImageDimensions(file: File): Promise<StickerDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        height: image.naturalHeight,
        width: image.naturalWidth,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image dimensions could not be read.'));
    };
    image.src = url;
  });
}

function readVideoDimensions(file: File): Promise<StickerDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        height: video.videoHeight,
        width: video.videoWidth,
      });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Video dimensions could not be read.'));
    };
    video.src = url;
  });
}
