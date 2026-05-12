import { createHash } from 'crypto';

export class StringValueObject {
  public constructor(private readonly value: string) {}

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

export class PrivateKey extends StringValueObject {
  public static fromPEM(value: string | StringValueObject): PrivateKey {
    return new PrivateKey(value.toString());
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
