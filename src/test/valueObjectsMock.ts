import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const gcmTagBytes = 16;

export class StringValueObject {
  public constructor(private readonly value: string) {}

  public isEqual(other: StringValueObject): boolean {
    return this.value === other.valueOf();
  }

  public isNotEqual(other: StringValueObject): boolean {
    return !this.isEqual(other);
  }

  public isEmpty(): boolean {
    return this.value.length === 0;
  }

  public toString(): string {
    return this.value;
  }

  public valueOf(): string {
    return this.value;
  }
}

export class EncryptedPayload extends StringValueObject {}

export class Signature extends StringValueObject {}

export class SHA256Hash extends StringValueObject {
  public static from(value: Buffer | string | StringValueObject): SHA256Hash {
    return new SHA256Hash(
      createHash('sha256').update(value.toString()).digest('hex'),
    );
  }
}

export class UUID extends StringValueObject {
  public static generate(): UUID {
    return new UUID(globalThis.crypto.randomUUID());
  }
}

export class CryptoAdapter {
  public static decryptAes256Gcm(
    key: Uint8Array,
    iv: Uint8Array,
    cipherText: Uint8Array,
    tag: Uint8Array,
  ): Buffer {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);

    decipher.setAuthTag(Buffer.from(tag));

    return Buffer.concat([
      decipher.update(Buffer.from(cipherText)),
      decipher.final(),
    ]);
  }

  public static encryptAes256Gcm(
    key: Uint8Array,
    iv: Uint8Array,
    message: Uint8Array,
  ): { cipherText: Uint8Array; tag: Uint8Array } {
    const cipher = createCipheriv('aes-256-gcm', key, iv, {
      authTagLength: gcmTagBytes,
    });
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(message)),
      cipher.final(),
    ]);

    return {
      cipherText: encrypted,
      tag: cipher.getAuthTag(),
    };
  }

  public static randomBytes(size: number): Buffer {
    return randomBytes(size);
  }
}

export class PrivateKey extends StringValueObject {
  public static fromPEM(value: string | StringValueObject): PrivateKey {
    return new PrivateKey(value.toString());
  }

  public getPublicKey(): PublicKey {
    return new PublicKey('public-key');
  }

  public decrypt(): Uint8Array {
    throw new Error('decrypt not available in unit-test value object mock');
  }
}

export class PublicKey extends StringValueObject {
  public static fromPEM(value: string | StringValueObject): PublicKey {
    return new PublicKey(value.toString());
  }

  public encrypt(payload: StringValueObject): EncryptedPayload {
    return new EncryptedPayload(payload.toString());
  }
}

export class EncryptedPrivateKey extends StringValueObject {}

export class EncryptedKeyPair {
  public constructor(
    public readonly publicKey: PublicKey,
    public readonly encryptedPrivateKey: EncryptedPrivateKey,
  ) {}
}

export class KeyPair {
  public static async generate(): Promise<KeyPair> {
    return new KeyPair();
  }

  public toPrimitives(): { privateKey: string; publicKey: string } {
    return {
      privateKey: 'private-key',
      publicKey: 'public-key',
    };
  }
}
