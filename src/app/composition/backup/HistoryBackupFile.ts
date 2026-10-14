import {
  decodeBase64Url,
  encodeBase64Url,
} from '../../../shared/infrastructure/encoding/base64url';
import { HistoryBackupUnreadableError } from './HistoryBackupUnreadableError';
import { HistoryBackupVersionError } from './HistoryBackupVersionError';

/**
 * The backup file: `{ format, version, iv, ciphertext }` as JSON. The content
 * is AES-256-GCM under a key derived by HKDF-SHA256 from the identity root, so
 * only the same identity opens it on any of its devices. The identity id and
 * the header are bound as additional data and never written in the clear.
 * Only the current version opens; older or newer files are rejected.
 */
export class HistoryBackupFile {
  private static readonly FORMAT = 'pigeon-swarm-backup';
  private static readonly IV_BYTES = 12;
  private static readonly LABEL = 'pigeon-swarm:history-backup';
  private static readonly VERSION = 1;

  private static additionalData(identityId: string): Uint8Array<ArrayBuffer> {
    return new TextEncoder().encode(
      JSON.stringify([
        HistoryBackupFile.FORMAT,
        HistoryBackupFile.VERSION,
        identityId,
      ]),
    );
  }

  private static async key(
    root: Uint8Array,
    identityId: string,
  ): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const label = HistoryBackupFile.LABEL;
    const material = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(root),
      'HKDF',
      false,
      ['deriveKey'],
    );

    return await crypto.subtle.deriveKey(
      {
        hash: 'SHA-256',
        info: encoder.encode(`${label}:v1:${identityId}`),
        name: 'HKDF',
        salt: encoder.encode(`${label}:salt`),
      },
      material,
      { length: 256, name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  private static fields(file: string): Record<string, unknown> {
    let parsed: unknown;

    try {
      parsed = JSON.parse(file);
    } catch {
      throw new HistoryBackupUnreadableError();
    }

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new HistoryBackupUnreadableError();
    }

    return parsed as Record<string, unknown>;
  }

  private static parse(file: string): { ciphertext: string; iv: string } {
    const fields = HistoryBackupFile.fields(file);

    if (fields.format !== HistoryBackupFile.FORMAT) {
      throw new HistoryBackupUnreadableError();
    }

    if (fields.version !== HistoryBackupFile.VERSION) {
      throw new HistoryBackupVersionError();
    }

    if (
      typeof fields.iv !== 'string' ||
      typeof fields.ciphertext !== 'string'
    ) {
      throw new HistoryBackupUnreadableError();
    }

    return { ciphertext: fields.ciphertext, iv: fields.iv };
  }

  /** Throws a backup error when the file is not this identity's backup. */
  public static async open(
    root: Uint8Array,
    identityId: string,
    file: string,
  ): Promise<Uint8Array> {
    const fields = HistoryBackupFile.parse(file);
    const iv = new Uint8Array(decodeBase64Url(fields.iv));

    if (iv.byteLength !== HistoryBackupFile.IV_BYTES) {
      throw new HistoryBackupUnreadableError();
    }

    try {
      return new Uint8Array(
        await crypto.subtle.decrypt(
          {
            additionalData: HistoryBackupFile.additionalData(identityId),
            iv,
            name: 'AES-GCM',
          },
          await HistoryBackupFile.key(root, identityId),
          new Uint8Array(decodeBase64Url(fields.ciphertext)),
        ),
      );
    } catch {
      throw new HistoryBackupUnreadableError();
    }
  }

  public static async seal(
    root: Uint8Array,
    identityId: string,
    plaintext: Uint8Array,
  ): Promise<string> {
    const iv = crypto.getRandomValues(
      new Uint8Array(HistoryBackupFile.IV_BYTES),
    );
    const ciphertext = await crypto.subtle.encrypt(
      {
        additionalData: HistoryBackupFile.additionalData(identityId),
        iv,
        name: 'AES-GCM',
      },
      await HistoryBackupFile.key(root, identityId),
      new Uint8Array(plaintext),
    );

    return JSON.stringify({
      ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
      format: HistoryBackupFile.FORMAT,
      iv: encodeBase64Url(iv),
      version: HistoryBackupFile.VERSION,
    });
  }
}
