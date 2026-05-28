const webpContentType = 'image/webp';
const webpQuality = 0.88;
const convertibleImageTypes = new Set([
  'image/avif',
  'image/bmp',
  'image/jpeg',
  'image/png',
]);

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
      reject(new Error('Image could not be loaded.'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);

          return;
        }

        reject(new Error('Image could not be exported as WebP.'));
      },
      webpContentType,
      webpQuality,
    );
  });
}

async function encodeImageAsWebp(file: File): Promise<Blob> {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context || width <= 0 || height <= 0) {
    throw new Error('Image could not be converted to WebP.');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return await canvasToBlob(canvas);
}

export class PublicImageUploadPreparer {
  public constructor(
    private readonly encodeImage: (
      file: File,
    ) => Promise<Blob> = encodeImageAsWebp,
  ) {}

  public async prepare(file: File): Promise<File> {
    if (!this.shouldConvert(file)) return file;

    const blob = await this.encodeImage(file);

    return new File([blob], this.webpFilename(file.name), {
      lastModified: file.lastModified,
      type: webpContentType,
    });
  }

  private shouldConvert(file: File): boolean {
    return convertibleImageTypes.has(this.contentType(file));
  }

  private contentType(file: File): string {
    const contentType = (file.type ?? '').trim().toLowerCase();

    if (contentType) return contentType;

    if (/\.(?:jpg|jpeg)$/i.test(file.name)) return 'image/jpeg';

    if (/\.png$/i.test(file.name)) return 'image/png';

    if (/\.bmp$/i.test(file.name)) return 'image/bmp';

    if (/\.avif$/i.test(file.name)) return 'image/avif';

    return '';
  }

  private webpFilename(filename: string): string {
    const basename = filename.replace(/\.[^.]+$/, '') || 'image';

    return `${basename}.webp`;
  }
}
