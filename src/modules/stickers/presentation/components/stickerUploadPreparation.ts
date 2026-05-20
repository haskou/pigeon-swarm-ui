import type {
  PublicFileUpload,
  StickerDimensions,
  StickerType,
} from '../../../../shared/domain/pigeonResources.types';

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
): Promise<{ dimensions: StickerDimensions; file: File }> {
  const originalDimensions = await readMediaDimensions(file);
  const type = stickerTypeFromFile(file);
  const scaledFile =
    type === 'static' && dimensionsExceedStickerLimit(originalDimensions)
      ? await scaleStaticStickerImage(file, originalDimensions)
      : file;
  const dimensions =
    scaledFile === file
      ? originalDimensions
      : await readMediaDimensions(scaledFile);

  if (dimensionsExceedStickerLimit(dimensions)) {
    throw new Error(
      'Sticker dimensions must be 512x512 or smaller. Animated and video stickers must already fit this size.',
    );
  }

  const maxSizeBytes = STICKER_SIZE_LIMITS[type];

  if (scaledFile.size > maxSizeBytes) {
    throw new Error(
      `Sticker is too large. ${stickerTypeLabel(type)} stickers can be up to ${formatBytes(maxSizeBytes)}.`,
    );
  }

  return {
    dimensions,
    file: scaledFile,
  };
}

function stickerTypeFromFile(file: File): StickerType {
  if (file.type.startsWith('video/')) return 'video';

  if (file.type === 'image/gif') return 'animated';

  return 'static';
}

function dimensionsExceedStickerLimit(dimensions: StickerDimensions): boolean {
  return (
    dimensions.width > STICKER_MAX_EDGE || dimensions.height > STICKER_MAX_EDGE
  );
}

async function scaleStaticStickerImage(
  file: File,
  dimensions: StickerDimensions,
): Promise<File> {
  const scale = Math.min(
    STICKER_MAX_EDGE / dimensions.width,
    STICKER_MAX_EDGE / dimensions.height,
  );
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

  const contentType = canvasOutputType(file);
  const blob = await canvasToBlob(canvas, contentType);

  return new File([blob], file.name, {
    lastModified: file.lastModified,
    type: blob.type || contentType,
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

function canvasOutputType(file: File): string {
  if (file.type === 'image/png') return 'image/png';

  if (file.type === 'image/webp') return 'image/webp';

  if (file.type === 'image/jpeg') return 'image/jpeg';

  return 'image/png';
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  contentType: string,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);

        return;
      }

      reject(new Error('Sticker could not be resized.'));
    }, contentType);
  });
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
