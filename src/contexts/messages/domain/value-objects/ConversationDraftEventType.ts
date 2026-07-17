import { Enum } from '@haskou/value-objects';

const values = ['ConversationDraftSaved'] as const;

export class ConversationDraftEventType extends Enum<(typeof values)[number]> {
  public static readonly SAVED = new ConversationDraftEventType(
    'ConversationDraftSaved',
  );

  private constructor(value: 'ConversationDraftSaved') {
    super(value);
  }

  public getValues(): Array<(typeof values)[number]> {
    return [...values];
  }
}
