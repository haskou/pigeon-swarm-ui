const urlPattern = /\b(?:https?:\/\/|www\.)[^\s<>"']+/i;

export class MessageLinkPreviews {
  public static firstUrl(content: string): string | null {
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
}
