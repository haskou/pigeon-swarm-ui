import { ApiUrlBuilder } from './ApiUrlBuilder';
import { HttpJsonError } from './HttpJsonError';

type BlobRequestInit = RequestInit & {
  onDownloadProgress?: (progress: {
    loadedBytes: number;
    totalBytes?: number;
  }) => void;
};

export class HttpJsonClient {
  public constructor(private readonly urls: ApiUrlBuilder) {}

  public async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(this.urls.build(path), {
      ...init,
      cache: init.cache ?? 'no-store',
      headers: this.headers(init, 'application/json'),
    });

    if (!response.ok) {
      throw await this.error(response);
    }

    if (response.status === 204 || response.status === 304) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  public async requestBlob(
    path: string,
    init: BlobRequestInit = {},
  ): Promise<Blob> {
    const { onDownloadProgress, ...requestInit } = init;
    const response = await fetch(this.urls.build(path), {
      ...requestInit,
      cache: requestInit.cache ?? 'no-store',
      headers: this.headers(requestInit, '*/*'),
    });

    if (!response.ok) {
      throw await this.error(response);
    }

    if (!onDownloadProgress || !response.body) {
      const blob = await response.blob();

      onDownloadProgress?.({
        loadedBytes: blob.size,
        totalBytes: blob.size,
      });

      return blob;
    }

    return await this.blobWithProgress(response, onDownloadProgress);
  }

  private async blobWithProgress(
    response: Response,
    onDownloadProgress: NonNullable<BlobRequestInit['onDownloadProgress']>,
  ): Promise<Blob> {
    const reader = response.body!.getReader();
    const chunks: ArrayBuffer[] = [];
    const totalBytes = Number(response.headers.get('Content-Length')) || 0;
    let done = false;
    let loadedBytes = 0;

    while (!done) {
      const result = await reader.read();

      done = result.done;

      if (done || !result.value) continue;

      const value = result.value;

      chunks.push(
        value.buffer.slice(
          value.byteOffset,
          value.byteOffset + value.byteLength,
        ),
      );
      loadedBytes += value.byteLength;
      onDownloadProgress({
        loadedBytes,
        ...(totalBytes ? { totalBytes } : {}),
      });
    }

    return new Blob(chunks, {
      type: response.headers.get('Content-Type') ?? undefined,
    });
  }

  private async error(response: Response): Promise<HttpJsonError> {
    const text = await response.text().catch(() => '');

    return new HttpJsonError(response.status, response.statusText, text);
  }

  private headers(init: RequestInit, accept: string): HeadersInit {
    const headers = init.headers ?? {};
    const headerRecord = this.headerRecord(headers);

    return {
      Accept: accept,
      ...(init.body &&
      typeof init.body === 'string' &&
      !this.hasHeader(headers, 'Content-Type')
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...headerRecord,
    };
  }

  private headerRecord(headers: HeadersInit): Record<string, string> {
    if (headers instanceof Headers) {
      return Object.fromEntries(headers.entries());
    }

    if (Array.isArray(headers)) return Object.fromEntries(headers);

    return headers;
  }

  private hasHeader(headers: HeadersInit, name: string): boolean {
    const normalizedName = name.toLowerCase();

    if (headers instanceof Headers) return headers.has(name);

    if (Array.isArray(headers)) {
      return headers.some(([key]) => key.toLowerCase() === normalizedName);
    }

    return Object.keys(headers).some(
      (key) => key.toLowerCase() === normalizedName,
    );
  }
}
