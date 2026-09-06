import type { SelectedClientNode } from './SelectedClientNode';

import { ClientNodeEndpoint } from './ClientNodeEndpoint';

export class ClientNodeSelection {
  private static readonly key = 'pigeon-swarm-client-node-v1';

  public constructor(private readonly storage: Storage) {}

  private isSelection(value: unknown): value is SelectedClientNode {
    if (typeof value !== 'object' || value === null) return false;

    return (
      'url' in value &&
      typeof value.url === 'string' &&
      'scope' in value &&
      typeof value.scope === 'string' &&
      /^[a-f0-9]{64}$/.test(value.scope)
    );
  }

  public read(): SelectedClientNode | undefined {
    try {
      const value: unknown = JSON.parse(
        this.storage.getItem(ClientNodeSelection.key) ?? 'null',
      );

      if (!this.isSelection(value)) return undefined;

      return {
        scope: value.scope,
        url: ClientNodeEndpoint.normalize(value.url),
      };
    } catch {
      return undefined;
    }
  }

  public async save(endpoint: string): Promise<void> {
    const url = ClientNodeEndpoint.normalize(endpoint);
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(url),
    );
    const scope = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    this.storage.setItem(
      ClientNodeSelection.key,
      JSON.stringify({ scope, url }),
    );
  }
}
