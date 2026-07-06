import { API_SERVER_URL } from '../../app/API_SERVER_URL';
import { ApiUrlBuilder } from '../infrastructure/http/ApiUrlBuilder';

export type IpfsLink = {
  cid: string;
  label: string;
  path: string;
  url: string;
};

export function ipfsUrl(cid: string): string {
  return absoluteApiUrl(
    new ApiUrlBuilder(API_SERVER_URL).build(
      `/ipfs/${encodeURIComponent(cid)}`,
    ),
  );
}

export function collectIpfsLinks(input: unknown): IpfsLink[] {
  const links = new Map<string, IpfsLink>();

  collectIpfsLinksFromValue(input, [], links);

  return [...links.values()];
}

function collectIpfsLinksFromValue(
  value: unknown,
  path: string[],
  links: Map<string, IpfsLink>,
): void {
  if (!value) return;

  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      collectIpfsLinksFromValue(entry, [...path, String(index)], links),
    );

    return;
  }

  if (typeof value !== 'object') return;

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const nextPath = [...path, key];

    if (typeof entry === 'string' && looksLikeIpfsField(key, entry)) {
      const label = labelForIpfsPath(nextPath);

      if (!links.has(`${label}:${entry}`)) {
        links.set(`${label}:${entry}`, {
          cid: entry,
          label,
          path: nextPath.join('.'),
          url: ipfsUrl(entry),
        });
      }
    }

    collectIpfsLinksFromValue(entry, nextPath, links);
  });
}

function looksLikeIpfsField(key: string, value: string): boolean {
  const normalizedKey = key.toLowerCase();
  const normalizedValue = value.trim();

  if (!normalizedValue) return false;

  return (
    normalizedKey === 'cid' ||
    normalizedKey.endsWith('cid') ||
    normalizedKey === 'avatar' ||
    normalizedKey === 'banner' ||
    normalizedKey === 'picture' ||
    normalizedKey === 'image' ||
    normalizedKey.includes('externalidentifier') ||
    normalizedValue.startsWith('bafy') ||
    normalizedValue.startsWith('Qm')
  );
}

function labelForIpfsPath(path: string[]): string {
  const key = path[path.length - 1] ?? 'cid';
  const parent = path[path.length - 2];

  if (key === 'cid') {
    const collection = path[path.length - 3];

    if (parent && collection && isArrayIndex(parent)) {
      return `${singularLabel(collection)} ${Number(parent) + 1} cid`;
    }

    return parent ? `${parent} cid` : 'cid';
  }

  if (isArrayIndex(key) && parent) {
    return `${singularLabel(parent)} ${Number(key) + 1}`;
  }

  return key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function isArrayIndex(value: string): boolean {
  return /^\d+$/.test(value);
}

function singularLabel(value: string): string {
  const label = value.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

  return label.endsWith('s') ? label.slice(0, -1) : label;
}

function absoluteApiUrl(url: string): string {
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(url)) return url;

  const origin = globalThis.location?.origin;

  if (!origin || origin === 'null') return url;

  return new URL(url, origin).toString();
}
