const BROWSER_PREVIEW_IMAGE_TYPES = new Set([
  'image/apng',
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/webp',
]);

export function isBrowserPreviewImage(contentType: string): boolean {
  return BROWSER_PREVIEW_IMAGE_TYPES.has(contentType.toLowerCase());
}
