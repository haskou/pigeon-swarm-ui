import type { Session } from '../../shared/domain/pigeonResources.types';
import type {
  RealtimeHeartbeatActivityMode,
  RealtimeMessage,
  RealtimeTypingInput,
} from '../../shared/infrastructure/realtime/realtimeGateway';

import { RealtimeGateway } from '../../shared/infrastructure/realtime/realtimeGateway';

export class PigeonRealtimeApplication {
  public constructor(private readonly realtime: RealtimeGateway) {}

  public async connect(
    session: Session,
    onMessage: (message: RealtimeMessage) => void,
  ): Promise<WebSocket> {
    return await this.realtime.connect(session, onMessage);
  }

  public setHeartbeatActivityMode(
    session: Session,
    mode: RealtimeHeartbeatActivityMode,
  ): void {
    this.realtime.setHeartbeatActivityMode(session, mode);
  }

  public sendTyping(socket: WebSocket, input: RealtimeTypingInput): void {
    this.realtime.sendTyping(socket, input);
  }
}
