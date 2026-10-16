import type {
  DeviceRootRowKeys,
  SymmetricKey,
} from '@haskou/pigeon-swarm-crypto';
import type { Buffer } from 'buffer';

import type { GroupMessageHistoryConversation } from './GroupMessageHistoryConversation';

/**
 * What the group history holds in memory for one identity under one
 * device-sealed root: its keys and its opened conversations.
 */
export class GroupMessageHistoryScope {
  private readonly root: Buffer;

  public readonly conversations = new Map<
    string,
    GroupMessageHistoryConversation
  >();

  public constructor(
    root: SymmetricKey,
    public readonly keys: DeviceRootRowKeys,
  ) {
    this.root = root.getBuffer();
  }

  public opensUnder(root: SymmetricKey): boolean {
    return this.root.equals(root.getBuffer());
  }
}
