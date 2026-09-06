import { ClientConnectionError } from './ClientConnectionError';
import { ClientNodeEndpoint } from './ClientNodeEndpoint';

export class ClientCompatibilityProbe {
  private async readContract(response: Response): Promise<unknown> {
    if (
      !response.headers.get('Content-Type')?.includes('application/json') ||
      !response.body
    ) {
      throw new ClientConnectionError('incompatible');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    try {
      let result = await reader.read();
      while (!result.done) {
        const value = result.value;
        bytes += value.byteLength;

        if (bytes > 4096) throw new ClientConnectionError('incompatible');
        text += decoder.decode(value, { stream: true });
        result = await reader.read();
      }

      return JSON.parse(text + decoder.decode()) as unknown;
    } finally {
      await reader.cancel();
    }
  }

  private isCompatible(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      'protocol' in value &&
      value.protocol === 'pigeon-swarm' &&
      'apiVersion' in value &&
      value.apiVersion === 1
    );
  }

  public async verify(endpoint: string, signal?: AbortSignal): Promise<void> {
    const url = ClientNodeEndpoint.normalize(endpoint);
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    const timeout = setTimeout(abort, 8000);
    signal?.addEventListener('abort', abort, { once: true });

    if (signal?.aborted) controller.abort();
    try {
      const response = await fetch(`${url}/client-contract`, {
        cache: 'no-store',
        credentials: 'omit',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal,
      });

      if (!response.ok)
        throw new ClientConnectionError(
          response.status === 404 ? 'incompatible' : 'unreachable',
        );

      if (!this.isCompatible(await this.readContract(response)))
        throw new ClientConnectionError('incompatible');
    } catch (error) {
      if (error instanceof ClientConnectionError) throw error;
      throw new ClientConnectionError('unreachable');
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
}
