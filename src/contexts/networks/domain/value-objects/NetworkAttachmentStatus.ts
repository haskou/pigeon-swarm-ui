import { Enum } from '@haskou/value-objects';

import type { NetworkAttachmentStatusValue } from './NetworkAttachmentStatusValue';

const values: readonly NetworkAttachmentStatusValue[] = ['attached', 'removed'];

export class NetworkAttachmentStatus extends Enum<(typeof values)[number]> {
  public static attached(): NetworkAttachmentStatus {
    return new NetworkAttachmentStatus('attached');
  }

  public static fromPrimitives(
    value: (typeof values)[number],
  ): NetworkAttachmentStatus {
    return new NetworkAttachmentStatus(value);
  }

  public static removed(): NetworkAttachmentStatus {
    return new NetworkAttachmentStatus('removed');
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }

  public isAttached(): boolean {
    return this.isEqual(NetworkAttachmentStatus.attached());
  }
}
