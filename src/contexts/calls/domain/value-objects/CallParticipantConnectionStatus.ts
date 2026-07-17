import { Enum } from '@haskou/value-objects';

export class CallParticipantConnectionStatus extends Enum<
  'connected' | 'disconnected'
> {
  public static readonly CONNECTED = new CallParticipantConnectionStatus(
    'connected',
  );

  public static readonly DISCONNECTED = new CallParticipantConnectionStatus(
    'disconnected',
  );

  private constructor(value: 'connected' | 'disconnected') {
    super(value);
  }

  public getValues(): Array<'connected' | 'disconnected'> {
    return ['connected', 'disconnected'];
  }

  public isConnected(): boolean {
    return this.isEqual(CallParticipantConnectionStatus.CONNECTED);
  }
}
