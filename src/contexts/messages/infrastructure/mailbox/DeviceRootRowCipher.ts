/**
 * AES-256-GCM for the rows of one local store, under a key derived by
 * HKDF-SHA256 from the device-sealed root, per identity and store label. A
 * sealed value is IV ‖ ciphertext. A canary sealed under the same key detects a
 * root change.
 */
export class DeviceRootRowCipher {
  private static readonly IV_BYTES = 12;

  /** `label` names the store, e.g. `pigeon-direct-history`. */
  public static async derive(
    root: Uint8Array,
    label: string,
    identityId: string,
  ): Promise<DeviceRootRowCipher> {
    const encoder = new TextEncoder();
    const material = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(root),
      'HKDF',
      false,
      ['deriveKey'],
    );
    const key = await crypto.subtle.deriveKey(
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

    return new DeviceRootRowCipher(
      key,
      encoder.encode(`${label}:canary`),
      encoder.encode(JSON.stringify(['canary', identityId])),
    );
  }

  private constructor(
    private readonly key: CryptoKey,
    private readonly canaryPlaintext: Uint8Array<ArrayBuffer>,
    private readonly canaryAad: Uint8Array<ArrayBuffer>,
  ) {}

  public async seal(
    aad: Uint8Array<ArrayBuffer>,
    plaintext: Uint8Array,
  ): Promise<Uint8Array<ArrayBuffer>> {
    const ivBytes = DeviceRootRowCipher.IV_BYTES;
    const iv = crypto.getRandomValues(new Uint8Array(ivBytes));
    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt(
        { additionalData: aad, iv, name: 'AES-GCM' },
        this.key,
        new Uint8Array(plaintext),
      ),
    );
    const sealed = new Uint8Array(ivBytes + ciphertext.byteLength);

    sealed.set(iv);
    sealed.set(ciphertext, ivBytes);

    return sealed;
  }

  /** The plaintext, or undefined when the value does not open under the key. */
  public async open(
    aad: Uint8Array<ArrayBuffer>,
    sealed: Uint8Array<ArrayBuffer>,
  ): Promise<Uint8Array | undefined> {
    const ivBytes = DeviceRootRowCipher.IV_BYTES;

    try {
      return new Uint8Array(
        await crypto.subtle.decrypt(
          {
            additionalData: aad,
            iv: sealed.subarray(0, ivBytes),
            name: 'AES-GCM',
          },
          this.key,
          sealed.subarray(ivBytes),
        ),
      );
    } catch {
      return undefined;
    }
  }

  public sealCanary(): Promise<Uint8Array<ArrayBuffer>> {
    return this.seal(this.canaryAad, this.canaryPlaintext);
  }

  public async opensCanary(sealed: Uint8Array<ArrayBuffer>): Promise<boolean> {
    return (await this.open(this.canaryAad, sealed)) !== undefined;
  }
}
