import type { MessageLinkPreview } from '../../infrastructure/http/resources/MessageLinkPreview';

import { cx } from '../../../../shared/presentation/cx';

// Renders text only: the preview image and the site favicon would be fetched
// from a sender-chosen origin and reveal the reader's address to it.
export function LinkPreviewCard({
  description,
  finalUrl,
  mine,
  siteName,
  title,
  url,
}: Omit<MessageLinkPreview, 'image'> & { mine: boolean }) {
  const safePreviewUrl =
    safeLinkPreviewUrl(finalUrl) ?? safeLinkPreviewUrl(url);

  if (!safePreviewUrl) return null;

  const label = siteName?.trim() || safePreviewUrl.hostname;

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
      <span className="block truncate text-xs font-black uppercase text-white/45">
        {label}
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
        {displayLinkPreviewUrl(safePreviewUrl)}
      </span>
    </a>
  );
}

function safeLinkPreviewUrl(value: string): URL | null {
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
