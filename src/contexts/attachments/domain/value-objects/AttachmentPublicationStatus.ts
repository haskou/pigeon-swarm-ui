import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class AttachmentPublicationStatus extends Enum<'planned' | 'published'> {
  private static readonly values: Array<'planned' | 'published'> = [
    'planned',
    'published',
  ];

  public static readonly PLANNED = new AttachmentPublicationStatus('planned');

  public static readonly PUBLISHED = new AttachmentPublicationStatus(
    'published',
  );

  private static isPublicationStatus(
    value: string,
  ): value is 'planned' | 'published' {
    return AttachmentPublicationStatus.values.some(
      (candidate) => candidate === value,
    );
  }

  public static fromPrimitives(value: string): AttachmentPublicationStatus {
    if (!AttachmentPublicationStatus.isPublicationStatus(value)) {
      throw new ValueNotInEnumError(value, AttachmentPublicationStatus.values);
    }

    return new AttachmentPublicationStatus(value);
  }

  private constructor(value: 'planned' | 'published') {
    super(value);
  }

  public getValues(): Array<'planned' | 'published'> {
    return AttachmentPublicationStatus.values;
  }

  public isPublished(): boolean {
    return this.isEqual(AttachmentPublicationStatus.PUBLISHED);
  }
}
