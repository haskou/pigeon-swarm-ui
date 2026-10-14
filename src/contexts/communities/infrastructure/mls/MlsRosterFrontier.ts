const PREFIX = 'pigeon:community-frontier:v1\n';
/** A wider frontier is refused, never truncated. */
const MAX_HEADS = 256;
/** An operation digest: base64url SHA-256 without padding. */
const DIGEST = /^[\w-]{43}$/;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * The roster revision an MLS commit or welcome binds: the sorted digests of
 * the latest signed roster operations its committer had folded, standing for
 * them and everything they descend from. A commit carries it as MLS
 * authenticated data and a welcome as a GroupInfo extension, so the
 * committer's leaf signs it and nobody else can change it.
 */
export class MlsRosterFrontier {
  /** A private-use extension type (RFC 9420, section 17.3). */
  public static readonly EXTENSION_TYPE = 0xf420;

  public static encode(frontier: readonly string[]): Uint8Array {
    return encoder.encode(PREFIX + [...frontier].sort().join('\n'));
  }

  /**
   * Empty bytes bind no operations, which no community roster admits;
   * anything malformed is undefined.
   */
  public static decode(bytes: Uint8Array): string[] | undefined {
    if (bytes.length === 0) return [];
    let text: string;

    try {
      text = decoder.decode(bytes);
    } catch {
      return undefined;
    }

    if (!text.startsWith(PREFIX)) return undefined;
    const body = text.slice(PREFIX.length);
    const frontier = body === '' ? [] : body.split('\n');

    return frontier.length <= MAX_HEADS &&
      frontier.every((digest) => DIGEST.test(digest))
      ? frontier
      : undefined;
  }
}
