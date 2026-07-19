import type { ApplicationServerKey } from './ApplicationServerKey';

export class ApplicationServerKeyDecoder {
  public decode(value: string): ApplicationServerKey {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = `${value}${padding}`.replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const output = new Uint8Array(new ArrayBuffer(rawData.length));

    for (let index = 0; index < rawData.length; index += 1) {
      output[index] = rawData.charCodeAt(index);
    }

    return output;
  }
}
