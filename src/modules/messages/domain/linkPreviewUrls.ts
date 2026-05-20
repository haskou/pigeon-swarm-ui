const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/i;

export function firstMessageLinkPreviewUrl(content: string): string | null {
  const match = content.match(urlPattern)?.[0];

  if (!match) return null;

  const cleaned = match.replace(/[),.;:!?]+$/g, '');
  const normalized = /^https?:\/\//i.test(cleaned)
    ? cleaned
    : `https://${cleaned}`;

  try {
    return new URL(normalized).toString();
  } catch {
    return null;
  }
}
