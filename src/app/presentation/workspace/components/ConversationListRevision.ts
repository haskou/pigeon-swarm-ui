/**
 * Tracks writes to the conversation list so that a request which started
 * before a write cannot replace the list with its older snapshot.
 */
export class ConversationListRevision {
  private revision = 0;

  /** Records a list write; requests begun before it no longer apply a list. */
  public recordWrite(): void {
    this.revision += 1;
  }

  /** Begins a request; the returned check stays true until the next write. */
  public begin(): () => boolean {
    const started = this.revision;

    return () => started === this.revision;
  }
}
