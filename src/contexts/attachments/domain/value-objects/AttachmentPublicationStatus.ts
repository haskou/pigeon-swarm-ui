import { Enum } from '@haskou/value-objects';

enum PublicationStatusValue {
  PLANNED = 'planned',
  PUBLISHED = 'published',
}

export class AttachmentPublicationStatus extends Enum<PublicationStatusValue> {
  public static readonly PLANNED = new AttachmentPublicationStatus(
    PublicationStatusValue.PLANNED,
  );

  public static readonly PUBLISHED = new AttachmentPublicationStatus(
    PublicationStatusValue.PUBLISHED,
  );

  private constructor(value: PublicationStatusValue) {
    super(value);
  }

  public getValues(): PublicationStatusValue[] {
    return Object.values(PublicationStatusValue);
  }

  public isPublished(): boolean {
    return this.isEqual(AttachmentPublicationStatus.PUBLISHED);
  }
}
