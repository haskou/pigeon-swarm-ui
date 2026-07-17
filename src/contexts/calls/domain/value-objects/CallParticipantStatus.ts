import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class CallParticipantStatus extends Enum<
  'declined' | 'joined' | 'left' | 'missed' | 'ringing'
> {
  private static readonly values: Array<
    'declined' | 'joined' | 'left' | 'missed' | 'ringing'
  > = ['declined', 'joined', 'left', 'missed', 'ringing'];

  public static readonly DECLINED = new CallParticipantStatus('declined');
  public static readonly JOINED = new CallParticipantStatus('joined');
  public static readonly LEFT = new CallParticipantStatus('left');
  public static readonly MISSED = new CallParticipantStatus('missed');
  public static readonly RINGING = new CallParticipantStatus('ringing');

  private static isStatus(
    value: string,
  ): value is 'declined' | 'joined' | 'left' | 'missed' | 'ringing' {
    return CallParticipantStatus.values.some((status) => status === value);
  }

  public static fromPrimitives(value: string): CallParticipantStatus {
    if (!CallParticipantStatus.isStatus(value)) {
      throw new ValueNotInEnumError(value, CallParticipantStatus.values);
    }

    return new CallParticipantStatus(value);
  }

  private constructor(
    value: 'declined' | 'joined' | 'left' | 'missed' | 'ringing',
  ) {
    super(value);
  }

  public getValues(): Array<
    'declined' | 'joined' | 'left' | 'missed' | 'ringing'
  > {
    return CallParticipantStatus.values;
  }

  public isJoined(): boolean {
    return this.isEqual(CallParticipantStatus.JOINED);
  }
}
