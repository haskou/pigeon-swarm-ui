import { isBrowserPreviewFile } from '../../../../shared/presentation/isBrowserPreviewFile';

const thumbnailContentType = 'image/webp';
const thumbnailQuality = 0.72;
const thumbnailMaxDimension = 480;
const thumbnailThresholdBytes = 128 * 1024;

type ThumbnailDimensions = {
  height: number;
  width: number;
};

export class MessageAttachmentThumbnailPreparer {
  public async prepare(file: File): Promise<File | null> {
    if (!this.shouldPrepare(file)) return null;

    const image = await this.loadImage(file);
    const dimensions = this.thumbnailDimensions(image);

    if (!dimensions) return null;

    const blob = await this.renderWebpThumbnail(image, dimensions);

    if (blob.size >= file.size) return null;

    return new File([blob], this.thumbnailFilename(file.name), {
      lastModified: file.lastModified,
      type: thumbnailContentType,
    });
  }

  private shouldPrepare(file: File): boolean {
    if (file.size <= thumbnailThresholdBytes) return false;

    if ((file.type ?? '').toLowerCase() === 'image/svg+xml') return false;

    return isBrowserPreviewFile(file);
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();

      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image thumbnail could not be loaded.'));
      };
      image.src = url;
    });
  }

  private thumbnailDimensions(
    image: HTMLImageElement,
  ): ThumbnailDimensions | null {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    if (sourceWidth <= 0 || sourceHeight <= 0) return null;

    const scale = Math.min(
      1,
      thumbnailMaxDimension / Math.max(sourceWidth, sourceHeight),
    );

    return {
      height: Math.max(1, Math.round(sourceHeight * scale)),
      width: Math.max(1, Math.round(sourceWidth * scale)),
    };
  }

  private renderWebpThumbnail(
    image: HTMLImageElement,
    dimensions: ThumbnailDimensions,
  ): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    if (!context) {
      return Promise.reject(
        new Error('Image thumbnail could not be rendered.'),
      );
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);

            return;
          }

          reject(new Error('Image thumbnail could not be exported.'));
        },
        thumbnailContentType,
        thumbnailQuality,
      );
    });
  }

  private thumbnailFilename(filename: string): string {
    const basename = filename.replace(/\.[^.]+$/, '') || 'image';

    return `${basename}.thumbnail.webp`;
  }
}
