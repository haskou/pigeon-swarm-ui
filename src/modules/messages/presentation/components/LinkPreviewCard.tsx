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
        <img
          src={safeImageUrl}
          alt=""
          className="-mx-3 -mt-3 mb-3 aspect-[1.91/1] w-[calc(100%+1.5rem)] object-cover"
          onError={() => setImageVisible(false)}
        />
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
