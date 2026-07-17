import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

const values = [
  'ConversationActivityRecorded',
  'ConversationCreated',
  'ConversationParticipantInvited',
  'ConversationRead',
] as const;

export class ConversationEventType extends Enum<(typeof values)[number]> {
  public static readonly ACTIVITY_RECORDED = new ConversationEventType(
    'ConversationActivityRecorded',
  );

  public static readonly CREATED = new ConversationEventType(
    'ConversationCreated',
  );

  public static readonly PARTICIPANT_INVITED = new ConversationEventType(
    'ConversationParticipantInvited',
  );

  public static readonly READ = new ConversationEventType('ConversationRead');

  public static fromPrimitives(value: string): ConversationEventType {
    const type = values.find((candidate) => candidate === value);

    if (!type) throw new ValueNotInEnumError(value, values);

    return new ConversationEventType(type);
  }

  private constructor(value: (typeof values)[number]) {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }
}
