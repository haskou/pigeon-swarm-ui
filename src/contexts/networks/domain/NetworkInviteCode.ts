import type { NetworkInvite } from './NetworkInvite';
import type { NetworkInvitePayload } from './NetworkInvitePayload';

export type { NetworkInvite } from './NetworkInvite';

const prefix = 'psn1.';

export class NetworkInviteCode {
  private static encodeBase64Url(value: string): string {
    return btoa(encodeURIComponent(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  private static decodeBase64Url(value: string): string {
    const padded = value.padEnd(
      value.length + ((4 - (value.length % 4)) % 4),
      '=',
    );
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');

    return decodeURIComponent(atob(base64));
  }

  public static encode(invite: NetworkInvite): string {
    return `${prefix}${this.encodeBase64Url(
      JSON.stringify({
        id: invite.id.trim(),
        key: invite.key.trim(),
        name: invite.name.trim(),
        version: 1,
      } satisfies NetworkInvitePayload),
    )}`;
  }

  public static decode(value: string): NetworkInvite {
    const normalized = value.trim();

    if (!normalized.startsWith(prefix)) {
      throw new Error('Invalid network code.');
    }

    const payload = JSON.parse(
      this.decodeBase64Url(normalized.slice(prefix.length)),
    ) as Partial<NetworkInvitePayload>;

    if (
      payload.version !== 1 ||
      !payload.id?.trim() ||
      !payload.key?.trim() ||
      !payload.name?.trim()
    ) {
      throw new Error('Invalid network code.');
    }

    return {
      id: payload.id.trim(),
      key: payload.key.trim(),
      name: payload.name.trim(),
    };
  }
}
