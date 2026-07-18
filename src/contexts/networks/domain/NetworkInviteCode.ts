import { InvalidNetworkInviteCodeError } from './errors/InvalidNetworkInviteCodeError';
import { NetworkInvite } from './NetworkInvite';

const prefix = 'psn1.';

export class NetworkInviteCode {
  private static hasTextProperty(value: object, property: string): boolean {
    const candidate: unknown = Reflect.get(value, property);

    return typeof candidate === 'string' && !!candidate.trim();
  }

  private static isPayload(
    value: unknown,
  ): value is { id: string; key: string; name: string; version: 1 } {
    if (typeof value !== 'object' || value === null) return false;

    return (
      this.hasTextProperty(value, 'id') &&
      this.hasTextProperty(value, 'key') &&
      this.hasTextProperty(value, 'name') &&
      Reflect.get(value, 'version') === 1
    );
  }

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
    const primitives = invite.toPrimitives();

    return `${prefix}${this.encodeBase64Url(
      JSON.stringify({
        id: primitives.id,
        key: primitives.key,
        name: primitives.name,
        version: 1,
      }),
    )}`;
  }

  public static decode(value: string): NetworkInvite {
    const normalized = value.trim();

    if (!normalized.startsWith(prefix)) {
      throw new InvalidNetworkInviteCodeError();
    }

    let payload: unknown;

    try {
      payload = JSON.parse(
        this.decodeBase64Url(normalized.slice(prefix.length)),
      );
    } catch {
      throw new InvalidNetworkInviteCodeError();
    }

    if (!this.isPayload(payload)) throw new InvalidNetworkInviteCodeError();

    return NetworkInvite.fromPrimitives({
      id: payload.id.trim(),
      key: payload.key.trim(),
      name: payload.name.trim(),
    });
  }
}
