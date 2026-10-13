import type { Session } from '../../../identities/infrastructure/session/Session';
import type { GroupMessageHistoryStore } from '../history/GroupMessageHistoryStore';

import { GroupMessageId } from '../crypto/GroupMessageId';

/**
 * The authors of one conversation's sent messages during one sync pass:
 * those this device stored, looked up one id at a time, and those accepted
 * in this pass.
 */
export class GroupMessageAuthors {
  private readonly known = new Map<string, string | undefined>();

  public constructor(
    private readonly session: Session,
    private readonly conversationId: string,
    private readonly history: Pick<GroupMessageHistoryStore, 'author'>,
  ) {}

  private async authorOf(id: string): Promise<string | undefined> {
    if (!this.known.has(id)) {
      this.known.set(
        id,
        await this.history.author(this.session, this.conversationId, id),
      );
    }

    return this.known.get(id);
  }

  /** Records `sender` as the author of `id` unless another author holds it. */
  public async claim(id: string, sender: string): Promise<boolean> {
    if (((await this.authorOf(id)) ?? sender) !== sender) return false;
    this.known.set(id, sender);

    return true;
  }

  /** Whether `id` is a message `sender` sent under an id it owns. */
  public async owns(id: string, sender: string): Promise<boolean> {
    return (
      GroupMessageId.belongsTo(id, sender) &&
      (await this.authorOf(id)) === sender
    );
  }
}
