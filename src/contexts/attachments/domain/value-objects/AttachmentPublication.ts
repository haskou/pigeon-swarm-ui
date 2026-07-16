import { Enum } from '@haskou/value-objects';

enum AttachmentPublicationValue {
  ENCRYPTED = 'encrypted',
  PUBLIC = 'public',
}

export class AttachmentPublication extends Enum<AttachmentPublicationValue> {
  public static readonly ENCRYPTED = new AttachmentPublication(
    AttachmentPublicationValue.ENCRYPTED,
  );

  public static readonly PUBLIC = new AttachmentPublication(
    AttachmentPublicationValue.PUBLIC,
  );

  private constructor(value: AttachmentPublicationValue) {
    super(value);
  }

  public getValues(): AttachmentPublicationValue[] {
    return Object.values(AttachmentPublicationValue);
  }

  public isEncrypted(): boolean {
    return this.isEqual(AttachmentPublication.ENCRYPTED);
  }
}
