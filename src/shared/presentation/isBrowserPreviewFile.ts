import { isBrowserPreviewImage } from './isBrowserPreviewImage';

const BROWSER_PREVIEW_IMAGE_EXTENSIONS = new Set([
  'apng',
  'avif',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'svg',
  'webp',
]);

export function isBrowserPreviewFile(file: File): boolean {
  const contentType = (file.type ?? '').trim().toLowerCase();

  if (contentType && isBrowserPreviewImage(contentType)) return true;

  const extension = file.name.split('.').pop()?.toLowerCase();

  return extension ? BROWSER_PREVIEW_IMAGE_EXTENSIONS.has(extension) : false;
}
