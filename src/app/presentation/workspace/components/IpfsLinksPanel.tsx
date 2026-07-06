import { useState } from 'react';

import type { IpfsLink } from '../../../../shared/presentation/ipfsLinks';

import { copy } from '../../../../shared/presentation/i18n/copy';
import { shortId } from '../../../../shared/presentation/formatting';

export function IpfsLinksPanel({ links }: { links: IpfsLink[] }) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  if (links.length === 0) return null;

  const copyUrl = async (url: string) => {
    if (navigator.clipboard) await navigator.clipboard.writeText(url);

    setCopiedUrl(url);
    window.setTimeout(() => setCopiedUrl(null), 1600);
  };

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
        {copy.ipfs.links}
      </div>
      <div className="mt-3 grid gap-2">
        {links.map((link) => (
          <div
            key={`${link.path}:${link.cid}`}
            className="flex min-w-0 items-center gap-2 rounded-2xl bg-black/25 p-2 text-xs"
          >
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 transition hover:text-cyan-100"
            >
              <span className="block truncate font-black text-white/75">
                {link.label}
              </span>
              <span className="block truncate text-white/45">
                {shortId(link.cid)}
              </span>
            </a>
            <button
              type="button"
              onClick={() => void copyUrl(link.url)}
              className="shrink-0 rounded-xl bg-white/10 px-2.5 py-1.5 font-black text-white/65 transition hover:bg-white/15 hover:text-white"
            >
              {copiedUrl === link.url ? copy.profile.copied : copy.profile.copy}
            </button>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/10 text-white/65 transition hover:bg-white/15 hover:text-white"
              aria-label={copy.ipfs.open}
            >
              ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
