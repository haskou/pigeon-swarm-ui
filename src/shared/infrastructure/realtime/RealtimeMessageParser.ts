import type { RealtimeMessage } from './RealtimeGateway';

export class RealtimeMessageParser {
  public parse(data: unknown): RealtimeMessage | null {
    if (typeof data !== 'string') return null;

    try {
      const parsed = JSON.parse(data) as RealtimeMessage;

      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
}
