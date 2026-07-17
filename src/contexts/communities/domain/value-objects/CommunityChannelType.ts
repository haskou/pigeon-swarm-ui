import { Enum, ValueNotInEnumError } from '@haskou/value-objects';

export class CommunityChannelType extends Enum<'text' | 'voice'> {
  private static readonly values: Array<'text' | 'voice'> = ['text', 'voice'];

  public static readonly TEXT = new CommunityChannelType('text');

  public static readonly VOICE = new CommunityChannelType('voice');

  public static fromPrimitives(value: string): CommunityChannelType {
    const channelType = CommunityChannelType.values.find(
      (candidate) => candidate === value,
    );

    if (!channelType) {
      throw new ValueNotInEnumError(value, CommunityChannelType.values);
    }

    return new CommunityChannelType(channelType);
  }

  private constructor(value: 'text' | 'voice') {
    super(value);
  }

  public getValues(): Array<'text' | 'voice'> {
    return CommunityChannelType.values;
  }

  public isVoice(): boolean {
    return this.isEqual(CommunityChannelType.VOICE);
  }
}
