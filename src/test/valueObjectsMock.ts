import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const gcmTagBytes = 16;

function assert(condition: unknown, error: Error | string): void {
  if (condition) return;

  throw typeof error === 'string' ? new Error(error) : error;
}

class DomainError extends Error {}

class ValueNotInEnumError extends DomainError {
  public constructor(value: string, validValues: string[]) {
    super(`Value "${value}" must be one of: ${validValues.join(', ')}`);
  }
}

class StringValueObject {
  public constructor(
    private readonly value: string,
    maxLength?: number,
  ) {
    if (maxLength !== undefined && value.length > maxLength) {
      throw new Error('InvalidStringLengthError');
    }
  }

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

class EncryptedPayload extends StringValueObject {}

class SymmetricKey extends StringValueObject {
  public static fromBuffer(value: Buffer): SymmetricKey {
    return new SymmetricKey(value.toString('base64'));
  }

  public static fromBase64(value: string): SymmetricKey {
    return new SymmetricKey(value);
  }

  public static generate(): SymmetricKey {
    return new SymmetricKey(randomBytes(32).toString('base64'));
  }

  public static async fromPassword(
    password: string,
    input: { salt: string },
  ): Promise<SymmetricKey> {
    return new SymmetricKey(
      createHash('sha256').update(`${password}:${input.salt}`).digest('base64'),
    );
  }

  public decrypt(payload: EncryptedPayload): StringValueObject {
    const decrypted = Buffer.from(payload.toString(), 'base64').toString(
      'utf8',
    );

    try {
      const parsed = JSON.parse(decrypted) as {
        __pigeonTestKey?: string;
        payload?: string;
      };

      if (parsed.__pigeonTestKey) {
        if (parsed.__pigeonTestKey !== this.valueOf()) {
          throw new Error('Invalid encrypted payload key');
        }

        return new StringValueObject(parsed.payload ?? '');
      }
    } catch (caught) {
      if ((caught as Error).message === 'Invalid encrypted payload key') {
        throw caught;
      }
    }

    return new StringValueObject(decrypted);
  }

  public encrypt(payload: string | StringValueObject): EncryptedPayload {
    return new EncryptedPayload(
      Buffer.from(
        JSON.stringify({
          __pigeonTestKey: this.valueOf(),
          payload: payload.toString(),
        }),
        'utf8',
      ).toString('base64'),
    );
  }

  public getBuffer(): Buffer {
    return Buffer.from(this.valueOf(), 'base64');
  }
}

class Timestamp {
  private readonly value: number;

  public constructor(value?: Date | number | string | Timestamp) {
    if (value instanceof Timestamp) {
      this.value = value.valueOf();
      return;
    }

    if (value instanceof Date) {
      this.value = value.getTime();
      return;
    }

    this.value = value === undefined ? Date.now() : new Date(value).getTime();
  }

  public static now(): Timestamp {
    return new Timestamp();
  }

  public isAfter(other: Timestamp): boolean {
    return this.value > other.valueOf();
  }

  public isAfterOrEqual(other: Timestamp): boolean {
    return this.value >= other.valueOf();
  }

  public isBefore(other: Timestamp): boolean {
    return this.value < other.valueOf();
  }

  public isBeforeOrEqual(other: Timestamp): boolean {
    return this.value <= other.valueOf();
  }

  public isEqual(other: Timestamp): boolean {
    return this.value === other.valueOf();
  }

  public valueOf(): number {
    return this.value;
  }
}

class Signature extends StringValueObject {}

class SHA256Hash extends StringValueObject {
  public static from(value: Buffer | string | StringValueObject): SHA256Hash {
    return new SHA256Hash(
      createHash('sha256').update(value.toString()).digest('hex'),
    );
  }
}

class UUID extends StringValueObject {
  public static generate(): UUID {
    return new UUID(globalThis.crypto.randomUUID());
  }
}

class CryptoAdapter {
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

class PrivateKey extends StringValueObject {
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

class PublicKey extends StringValueObject {
  public static fromPEM(value: string | StringValueObject): PublicKey {
    return new PublicKey(value.toString());
  }

  public encrypt(payload: StringValueObject): EncryptedPayload {
    return new EncryptedPayload(payload.toString());
  }
}

class EncryptedPrivateKey extends StringValueObject {}

class EncryptedKeyPair {
  public constructor(
    public readonly publicKey: PublicKey,
    public readonly encryptedPrivateKey: EncryptedPrivateKey,
  ) {}

  public async sign(): Promise<Signature> {
    return new Signature('encrypted-keypair-signature');
  }

  public toPrimitives(): { encryptedPrivateKey: string; publicKey: string } {
    return {
      encryptedPrivateKey: this.encryptedPrivateKey.toString(),
      publicKey: this.publicKey.toString(),
    };
  }
}

class KeyPair {
  public constructor(
    private readonly publicKey: PublicKey = new PublicKey('public-key'),
    private readonly privateKey: PrivateKey = new PrivateKey('private-key'),
  ) {}

  public static async generate(): Promise<KeyPair> {
    return new KeyPair();
  }

  public async encryptKeyPair(): Promise<EncryptedKeyPair> {
    return new EncryptedKeyPair(
      new PublicKey('public-key'),
      new EncryptedPrivateKey('encrypted-private-key'),
    );
  }

  public sign(): Signature {
    return new Signature('keypair-signature');
  }

  public isValidSignature(): boolean {
    return true;
  }

  public toPrimitives(): { privateKey: string; publicKey: string } {
    return {
      privateKey: this.privateKey.toString(),
      publicKey: this.publicKey.toString(),
    };
  }
}

export {
  assert,
  CryptoAdapter,
  DomainError,
  EncryptedKeyPair,
  EncryptedPayload,
  EncryptedPrivateKey,
  KeyPair,
  PrivateKey,
  PublicKey,
  SHA256Hash,
  Signature,
  StringValueObject,
  SymmetricKey,
  Timestamp,
  UUID,
  ValueNotInEnumError,
};
