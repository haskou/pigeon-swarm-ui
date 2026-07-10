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
    <div className="mb-4">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
        {copy.ipfs.links}
      </div>
      <div className="mt-2 divide-y divide-white/10 border-y border-white/10">
        {links.map((link) => (
          <div
            key={`${link.path}:${link.cid}`}
            className="flex min-w-0 items-center gap-2 py-3 text-xs"
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
              className="ui-button min-h-8 shrink-0 px-2.5 py-1 text-xs"
            >
              {copiedUrl === link.url ? copy.profile.copied : copy.profile.copy}
            </button>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="ui-icon-button h-8 w-8 shrink-0"
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
