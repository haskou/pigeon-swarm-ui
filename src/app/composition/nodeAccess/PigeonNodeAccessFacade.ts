import type { IdentityAccessContexts } from '../../../contexts/identities/infrastructure/http/IdentityAccessContexts';
import type { Session } from '../../../contexts/identities/infrastructure/session/Session';
import type { PendingNodeBlockEntriesApprover } from '../../../contexts/nodeAccess/application/approve-pending-node-block-entries/PendingNodeBlockEntriesApprover';
import type { NodeEntryBlocker } from '../../../contexts/nodeAccess/application/block-node-entry/NodeEntryBlocker';
import type { NodeBlockPublicationChanger } from '../../../contexts/nodeAccess/application/change-node-block-publication/NodeBlockPublicationChanger';
import type { NodeRegistrationModeChanger } from '../../../contexts/nodeAccess/application/change-node-registration-mode/NodeRegistrationModeChanger';
import type { NodeBlockEntryExcepter } from '../../../contexts/nodeAccess/application/except-node-block-entry/NodeBlockEntryExcepter';
import type { NodeBlockExceptionsFinder } from '../../../contexts/nodeAccess/application/find-node-block-exceptions/NodeBlockExceptionsFinder';
import type { NodeBlockListFinder } from '../../../contexts/nodeAccess/application/find-node-block-list/NodeBlockListFinder';
import type { NodeBlockPublicationFinder } from '../../../contexts/nodeAccess/application/find-node-block-publication/NodeBlockPublicationFinder';
import type { NodeRegistrationFinder } from '../../../contexts/nodeAccess/application/find-node-registration/NodeRegistrationFinder';
import type { PendingNodeBlockEntriesFinder } from '../../../contexts/nodeAccess/application/find-pending-node-block-entries/PendingNodeBlockEntriesFinder';
import type { NodeBlockSourceFollower } from '../../../contexts/nodeAccess/application/follow-node-block-source/NodeBlockSourceFollower';
import type { NodeRegistrationCodeIssuer } from '../../../contexts/nodeAccess/application/issue-node-registration-code/NodeRegistrationCodeIssuer';
import type { NodeBlockExceptionRemover } from '../../../contexts/nodeAccess/application/remove-node-block-exception/NodeBlockExceptionRemover';
import type { NodeRegistrationCodeRevoker } from '../../../contexts/nodeAccess/application/revoke-node-registration-code/NodeRegistrationCodeRevoker';
import type { NodeBlockSourcesSearcher } from '../../../contexts/nodeAccess/application/search-node-block-sources/NodeBlockSourcesSearcher';
import type { NodeRegistrationCodesSearcher } from '../../../contexts/nodeAccess/application/search-node-registration-codes/NodeRegistrationCodesSearcher';
import type { NodeEntryUnblocker } from '../../../contexts/nodeAccess/application/unblock-node-entry/NodeEntryUnblocker';
import type { NodeBlockSourceUnfollower } from '../../../contexts/nodeAccess/application/unfollow-node-block-source/NodeBlockSourceUnfollower';
import type { NodeBlockExceptions } from '../../../contexts/nodeAccess/domain/NodeBlockExceptions';
import type {
  IssuedNodeRegistrationCodeViewModel,
  NodeBlockExceptionsViewModel,
  NodeBlockListViewModel,
  NodeBlockSourceViewModel,
  NodeBlockTargetViewModel,
  NodeRegistrationCodeViewModel,
  NodeRegistrationModeViewModel,
  PendingNodeBlockEntriesViewModel,
} from '../../../contexts/nodeAccess/presentation/view-models/NodeAccessViewModels';

import { ApprovePendingNodeBlockEntriesMessage } from '../../../contexts/nodeAccess/application/approve-pending-node-block-entries/messages/ApprovePendingNodeBlockEntriesMessage';
import { BlockNodeEntryMessage } from '../../../contexts/nodeAccess/application/block-node-entry/messages/BlockNodeEntryMessage';
import { ChangeNodeBlockPublicationMessage } from '../../../contexts/nodeAccess/application/change-node-block-publication/messages/ChangeNodeBlockPublicationMessage';
import { ChangeNodeRegistrationModeMessage } from '../../../contexts/nodeAccess/application/change-node-registration-mode/messages/ChangeNodeRegistrationModeMessage';
import { ExceptNodeBlockEntryMessage } from '../../../contexts/nodeAccess/application/except-node-block-entry/messages/ExceptNodeBlockEntryMessage';
import { FindNodeBlockExceptionsMessage } from '../../../contexts/nodeAccess/application/find-node-block-exceptions/messages/FindNodeBlockExceptionsMessage';
import { FindNodeBlockListMessage } from '../../../contexts/nodeAccess/application/find-node-block-list/messages/FindNodeBlockListMessage';
import { FindNodeBlockPublicationMessage } from '../../../contexts/nodeAccess/application/find-node-block-publication/messages/FindNodeBlockPublicationMessage';
import { FindNodeRegistrationMessage } from '../../../contexts/nodeAccess/application/find-node-registration/messages/FindNodeRegistrationMessage';
import { FindPendingNodeBlockEntriesMessage } from '../../../contexts/nodeAccess/application/find-pending-node-block-entries/messages/FindPendingNodeBlockEntriesMessage';
import { FollowNodeBlockSourceMessage } from '../../../contexts/nodeAccess/application/follow-node-block-source/messages/FollowNodeBlockSourceMessage';
import { IssueNodeRegistrationCodeMessage } from '../../../contexts/nodeAccess/application/issue-node-registration-code/messages/IssueNodeRegistrationCodeMessage';
import { RemoveNodeBlockExceptionMessage } from '../../../contexts/nodeAccess/application/remove-node-block-exception/messages/RemoveNodeBlockExceptionMessage';
import { RevokeNodeRegistrationCodeMessage } from '../../../contexts/nodeAccess/application/revoke-node-registration-code/messages/RevokeNodeRegistrationCodeMessage';
import { SearchNodeBlockSourcesMessage } from '../../../contexts/nodeAccess/application/search-node-block-sources/messages/SearchNodeBlockSourcesMessage';
import { SearchNodeRegistrationCodesMessage } from '../../../contexts/nodeAccess/application/search-node-registration-codes/messages/SearchNodeRegistrationCodesMessage';
import { UnblockNodeEntryMessage } from '../../../contexts/nodeAccess/application/unblock-node-entry/messages/UnblockNodeEntryMessage';
import { UnfollowNodeBlockSourceMessage } from '../../../contexts/nodeAccess/application/unfollow-node-block-source/messages/UnfollowNodeBlockSourceMessage';

/** The node owner's registration, blocking and block sharing controls. */
export class PigeonNodeAccessFacade {
  public constructor(
    private readonly identities: IdentityAccessContexts,
    private readonly useCases: {
      pendingNodeBlockEntriesApprover: PendingNodeBlockEntriesApprover;
      nodeEntryBlocker: NodeEntryBlocker;
      nodeBlockPublicationChanger: NodeBlockPublicationChanger;
      nodeRegistrationModeChanger: NodeRegistrationModeChanger;
      nodeBlockEntryExcepter: NodeBlockEntryExcepter;
      nodeBlockExceptionsFinder: NodeBlockExceptionsFinder;
      nodeBlockListFinder: NodeBlockListFinder;
      nodeBlockPublicationFinder: NodeBlockPublicationFinder;
      nodeRegistrationFinder: NodeRegistrationFinder;
      pendingNodeBlockEntriesFinder: PendingNodeBlockEntriesFinder;
      nodeBlockSourceFollower: NodeBlockSourceFollower;
      nodeRegistrationCodeIssuer: NodeRegistrationCodeIssuer;
      nodeBlockExceptionRemover: NodeBlockExceptionRemover;
      nodeRegistrationCodeRevoker: NodeRegistrationCodeRevoker;
      nodeBlockSourcesSearcher: NodeBlockSourcesSearcher;
      nodeRegistrationCodesSearcher: NodeRegistrationCodesSearcher;
      nodeEntryUnblocker: NodeEntryUnblocker;
      nodeBlockSourceUnfollower: NodeBlockSourceUnfollower;
    },
  ) {}

  private actorIdentityId(session: Session): string {
    this.identities.register(session);

    return session.identity.id;
  }

  private static exceptions(
    exceptions: NodeBlockExceptions,
  ): NodeBlockExceptionsViewModel {
    const { identityIds, nodePeerIds } = exceptions.toPrimitives();

    return { identityIds, nodePeerIds };
  }

  public async approvePendingEntries(
    sourceOwnerIdentityId: string,
    entry: NodeBlockTargetViewModel | undefined,
    session: Session,
  ): Promise<NodeBlockSourceViewModel> {
    const source = await this.useCases.pendingNodeBlockEntriesApprover.approve(
      new ApprovePendingNodeBlockEntriesMessage({
        actorIdentityId: this.actorIdentityId(session),
        entry,
        sourceOwnerIdentityId,
      }),
    );

    return source.toPrimitives();
  }

  public async block(
    target: NodeBlockTargetViewModel,
    session: Session,
  ): Promise<NodeBlockListViewModel> {
    const list = await this.useCases.nodeEntryBlocker.block(
      new BlockNodeEntryMessage({
        ...target,
        actorIdentityId: this.actorIdentityId(session),
      }),
    );

    return list.toPrimitives();
  }

  public async changePublication(
    published: boolean,
    session: Session,
  ): Promise<boolean> {
    const publication = await this.useCases.nodeBlockPublicationChanger.change(
      new ChangeNodeBlockPublicationMessage({
        actorIdentityId: this.actorIdentityId(session),
        published,
      }),
    );

    return publication.toPrimitives().published;
  }

  public async changeRegistrationMode(
    mode: NodeRegistrationModeViewModel,
    session: Session,
  ): Promise<NodeRegistrationModeViewModel> {
    const registration = await this.useCases.nodeRegistrationModeChanger.change(
      new ChangeNodeRegistrationModeMessage({
        actorIdentityId: this.actorIdentityId(session),
        mode,
      }),
    );

    return registration.toPrimitives().mode;
  }

  public async except(
    target: NodeBlockTargetViewModel,
    session: Session,
  ): Promise<NodeBlockExceptionsViewModel> {
    return PigeonNodeAccessFacade.exceptions(
      await this.useCases.nodeBlockEntryExcepter.except(
        new ExceptNodeBlockEntryMessage({
          ...target,
          actorIdentityId: this.actorIdentityId(session),
        }),
      ),
    );
  }

  public async followSource(
    source: { autoApply: boolean; origin: string; ownerIdentityId: string },
    session: Session,
  ): Promise<NodeBlockSourceViewModel> {
    const followed = await this.useCases.nodeBlockSourceFollower.follow(
      new FollowNodeBlockSourceMessage({
        actorIdentityId: this.actorIdentityId(session),
        autoApply: source.autoApply,
        origin: source.origin,
        sourceOwnerIdentityId: source.ownerIdentityId,
      }),
    );

    return followed.toPrimitives();
  }

  public async getBlockList(session: Session): Promise<NodeBlockListViewModel> {
    const list = await this.useCases.nodeBlockListFinder.find(
      new FindNodeBlockListMessage({
        actorIdentityId: this.actorIdentityId(session),
      }),
    );

    return list.toPrimitives();
  }

  public async getExceptions(
    session: Session,
  ): Promise<NodeBlockExceptionsViewModel> {
    return PigeonNodeAccessFacade.exceptions(
      await this.useCases.nodeBlockExceptionsFinder.find(
        new FindNodeBlockExceptionsMessage(this.actorIdentityId(session)),
      ),
    );
  }

  public async getPendingEntries(
    sourceOwnerIdentityId: string,
    session: Session,
  ): Promise<PendingNodeBlockEntriesViewModel> {
    const pending = await this.useCases.pendingNodeBlockEntriesFinder.find(
      new FindPendingNodeBlockEntriesMessage({
        actorIdentityId: this.actorIdentityId(session),
        sourceOwnerIdentityId,
      }),
    );

    return pending.toPrimitives();
  }

  public async getPublication(session: Session): Promise<boolean> {
    const publication = await this.useCases.nodeBlockPublicationFinder.find(
      new FindNodeBlockPublicationMessage(this.actorIdentityId(session)),
    );

    return publication.toPrimitives().published;
  }

  public async getRegistrationMode(
    session: Session,
  ): Promise<NodeRegistrationModeViewModel> {
    const registration = await this.useCases.nodeRegistrationFinder.find(
      new FindNodeRegistrationMessage(this.actorIdentityId(session)),
    );

    return registration.toPrimitives().mode;
  }

  public async getRegistrationCodes(
    session: Session,
  ): Promise<NodeRegistrationCodeViewModel[]> {
    const codes = await this.useCases.nodeRegistrationCodesSearcher.search(
      new SearchNodeRegistrationCodesMessage(this.actorIdentityId(session)),
    );

    return codes.map((code) => code.toPrimitives());
  }

  public async getSources(
    session: Session,
  ): Promise<NodeBlockSourceViewModel[]> {
    const sources = await this.useCases.nodeBlockSourcesSearcher.search(
      new SearchNodeBlockSourcesMessage(this.actorIdentityId(session)),
    );

    return sources.map((source) => source.toPrimitives());
  }

  public async issueRegistrationCode(
    request: { expiresAt: number; maxUses: number },
    session: Session,
  ): Promise<IssuedNodeRegistrationCodeViewModel> {
    const issued = await this.useCases.nodeRegistrationCodeIssuer.issue(
      new IssueNodeRegistrationCodeMessage({
        ...request,
        actorIdentityId: this.actorIdentityId(session),
      }),
    );

    return {
      ...issued.getCode().toPrimitives(),
      code: issued.getSecret().valueOf(),
    };
  }

  public async removeException(
    target: NodeBlockTargetViewModel,
    session: Session,
  ): Promise<NodeBlockExceptionsViewModel> {
    return PigeonNodeAccessFacade.exceptions(
      await this.useCases.nodeBlockExceptionRemover.remove(
        new RemoveNodeBlockExceptionMessage({
          ...target,
          actorIdentityId: this.actorIdentityId(session),
        }),
      ),
    );
  }

  public async revokeRegistrationCode(
    codeId: string,
    session: Session,
  ): Promise<void> {
    await this.useCases.nodeRegistrationCodeRevoker.revoke(
      new RevokeNodeRegistrationCodeMessage({
        actorIdentityId: this.actorIdentityId(session),
        codeId,
      }),
    );
  }

  public async unblock(
    target: NodeBlockTargetViewModel,
    session: Session,
  ): Promise<NodeBlockListViewModel> {
    const list = await this.useCases.nodeEntryUnblocker.unblock(
      new UnblockNodeEntryMessage({
        ...target,
        actorIdentityId: this.actorIdentityId(session),
      }),
    );

    return list.toPrimitives();
  }

  public async unfollowSource(
    sourceOwnerIdentityId: string,
    session: Session,
  ): Promise<NodeBlockSourceViewModel[]> {
    const sources = await this.useCases.nodeBlockSourceUnfollower.unfollow(
      new UnfollowNodeBlockSourceMessage({
        actorIdentityId: this.actorIdentityId(session),
        sourceOwnerIdentityId,
      }),
    );

    return sources.map((source) => source.toPrimitives());
  }
}
