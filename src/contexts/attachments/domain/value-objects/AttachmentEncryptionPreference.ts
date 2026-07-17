import { Enum } from '@haskou/value-objects';

import { AttachmentByteSize } from './AttachmentByteSize';

const smallAttachmentLimit = AttachmentByteSize.fromBytes(50 * 1024 * 1024);

enum PreferenceValue {
  ALL = 'all',
  LARGE_ONLY = 'large-only',
  NONE = 'none',
  SMALL_ONLY = 'small-only',
}

export class AttachmentEncryptionPreference extends Enum<PreferenceValue> {
  public static readonly ALL = new AttachmentEncryptionPreference(
    PreferenceValue.ALL,
  );

  public static readonly LARGE_ONLY = new AttachmentEncryptionPreference(
    PreferenceValue.LARGE_ONLY,
  );

  public static readonly NONE = new AttachmentEncryptionPreference(
    PreferenceValue.NONE,
  );

  public static readonly SMALL_ONLY = new AttachmentEncryptionPreference(
    PreferenceValue.SMALL_ONLY,
  );

  private constructor(value: PreferenceValue) {
    super(value);
  }

  private isEqualValue(value: PreferenceValue): boolean {
    return this.isEqual(new AttachmentEncryptionPreference(value));
  }

  public getValues(): PreferenceValue[] {
    return Object.values(PreferenceValue);
  }

  public requiresEncryption(size: AttachmentByteSize): boolean {
    if (this.isEqualValue(PreferenceValue.ALL)) return true;

    if (this.isEqualValue(PreferenceValue.NONE)) {
      return false;
    }

    const isSmall = size.fitsWithin(smallAttachmentLimit);

    return this.isEqualValue(PreferenceValue.SMALL_ONLY) ? isSmall : !isSmall;
  }
}
