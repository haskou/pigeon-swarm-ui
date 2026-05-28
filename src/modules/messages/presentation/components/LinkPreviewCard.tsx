import { useEffect, useState } from 'react';

import type { MessageLinkPreview } from '../../../../shared/domain/pigeonResources.types';

import { cx } from '../../../../shared/presentation/cx';

export function LinkPreviewCard({
  description,
  finalUrl,
  image,
  mine,
  siteName,
  title,
  url,
}: MessageLinkPreview & { mine: boolean }) {
  const safePreviewUrl =
    safeLinkPreviewUrl(finalUrl) ?? safeLinkPreviewUrl(url);
  const safeImageUrl = safeLinkPreviewUrl(image)?.toString() ?? null;
  const [imageVisible, setImageVisible] = useState(Boolean(safeImageUrl));
  const [imageLoaded, setImageLoaded] = useState(false);
  const displayUrl = safePreviewUrl
    ? displayLinkPreviewUrl(safePreviewUrl)
    : '';
  const hostname = safePreviewUrl ? safePreviewUrl.hostname : '';
  const faviconUrl = safePreviewUrl
    ? `${safePreviewUrl.origin}/favicon.ico`
    : '';
  const label = siteName?.trim() || hostname;

  useEffect(() => {
    setImageVisible(Boolean(safeImageUrl));
    setImageLoaded(false);
  }, [safeImageUrl]);

  if (!safePreviewUrl) return null;

  return (
    <a
      href={safePreviewUrl.toString()}
      target="_blank"
      rel="noreferrer"
      className={cx(
        'mt-3 block overflow-hidden rounded-2xl border p-3 text-left transition hover:brightness-110',
        mine ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/8',
      )}
    >
      {safeImageUrl && imageVisible && (
        <span className="-mx-3 -mt-3 mb-3 block aspect-[1.91/1] w-[calc(100%+1.5rem)] overflow-hidden bg-white/7 relative">
          {!imageLoaded && <LinkPreviewImageSkeleton />}
          <img
            src={safeImageUrl}
            alt=""
            className={cx(
              'h-full w-full object-cover transition-opacity duration-200',
              imageLoaded ? 'opacity-100' : 'opacity-0',
            )}
            decoding="async"
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageVisible(false)}
          />
        </span>
      )}
      <span className="flex items-center gap-2 text-xs font-black uppercase text-white/45">
        {faviconUrl && (
          <img
            src={faviconUrl}
            alt=""
            className="h-4 w-4 shrink-0 rounded-sm"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        )}
        <span className="truncate">{label}</span>
      </span>
      {title && (
        <span className="mt-1 block truncate text-sm font-black text-white">
          {title}
        </span>
      )}
      {description && (
        <span className="mt-1 line-clamp-2 text-xs leading-5 text-white/60">
          {description}
        </span>
      )}
      <span className="mt-2 block truncate text-[0.68rem] font-bold text-white/35">
        {displayUrl}
      </span>
    </a>
  );
}

function LinkPreviewImageSkeleton() {
  return (
    <span className="absolute inset-0 block animate-pulse">
      <span className="absolute inset-0 bg-gradient-to-br from-white/14 via-white/8 to-transparent" />
      <span className="absolute left-4 top-4 h-9 w-9 rounded-full bg-white/14" />
      <span className="absolute bottom-4 left-4 right-12 h-3 rounded-full bg-white/14" />
      <span className="absolute bottom-9 left-4 h-3 w-1/2 rounded-full bg-white/10" />
    </span>
  );
}

function safeLinkPreviewUrl(value?: null | string): URL | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function displayLinkPreviewUrl(url: URL): string {
  return `${url.hostname}${url.pathname}${url.search}`.replace(/\/$/, '');
}
