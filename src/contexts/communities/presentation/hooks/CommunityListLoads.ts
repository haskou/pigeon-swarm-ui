import { type CommunityListLoad } from './CommunityListLoad';

/**
 * Keeps one community list load alive. Starting a load, or cancelling, aborts
 * the one before it, so a reload loop that outlives its session, its identity
 * or a newer reload stops reading and writing.
 */
export class CommunityListLoads {
  private controller: AbortController | null = null;

  public begin(identityId: string): CommunityListLoad {
    this.cancel();
    const controller = new AbortController();

    this.controller = controller;

    return {
      identityId,
      isCurrent: () =>
        this.controller === controller && !controller.signal.aborted,
      signal: controller.signal,
    };
  }

  public cancel(): void {
    this.controller?.abort(new Error('The community list load was replaced.'));
    this.controller = null;
  }
}
