import { Enum } from '@haskou/value-objects';

export class CallRelayUsage extends Enum<'direct' | 'relay'> {
  public static readonly DIRECT = new CallRelayUsage('direct');
  public static readonly RELAY = new CallRelayUsage('relay');

  private constructor(value: 'direct' | 'relay') {
    super(value);
  }

  public getValues(): Array<'direct' | 'relay'> {
    return ['direct', 'relay'];
  }

  public usesRelay(): boolean {
    return this.isEqual(CallRelayUsage.RELAY);
  }
}
