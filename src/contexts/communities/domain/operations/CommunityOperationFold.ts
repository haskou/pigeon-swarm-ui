import { assert, DomainError } from '@haskou/value-objects';

import type { CommunityOperation } from './CommunityOperation';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { CommunityInvitation } from '../entities/invitations/CommunityInvitation';
import { CommunityInvitations } from '../entities/invitations/CommunityInvitations';
import { CommunityOperationRejectedError } from '../errors/CommunityOperationRejectedError';
import { CommunityAuthority } from './CommunityAuthority';
import { CommunityAuthorityCuts } from './CommunityAuthorityCuts';
import { CommunityOperationAncestry } from './CommunityOperationAncestry';

/** What a set of operations proves: the authority and the invitations. */
export interface CommunityOperationFoldState {
  /** `undefined` when there is no genesis or the community was deleted. */
  authority?: CommunityAuthority;
  invitations: CommunityInvitations;
  /** Hashes of the operations that proved nothing. */
  skipped: string[];
}

/** Operations one identity other than the founder signs in one community. */
const MAX_OPERATIONS_PER_AUTHOR = 1_000;

/** The actions that need the invitations of their own causal past. */
const LEDGERED_ACTIONS = ['invitation_created', 'invitation_revoked'];

/**
 * The authority a community's signed operations prove, folded exactly as the
 * nodes fold them: parents first and the lowest digest first among concurrent
 * operations, each one authorised again against the state it applies to, the
 * operations beyond an author's quota skipped, nothing applied once the
 * community has no members left. Invitations, their revocations and their
 * admissions are also checked against the state of their own causal past, and
 * the authority cuts void what a concurrent kick, ban or role change took.
 * An operation whose parents are not all known proves nothing, nor does
 * anything built on it.
 */
export class CommunityOperationFold {
  /**
   * `authority` after `operation`, or as it was when its state does not allow
   * the operation: such an operation proves nothing.
   */
  private static applied(
    authority: CommunityAuthority | undefined,
    operation: CommunityOperation,
  ): { applied: boolean; authority?: CommunityAuthority } {
    try {
      if (operation.isGenesis()) {
        return {
          applied: !authority,
          authority: authority ?? CommunityAuthority.create(operation),
        };
      }

      authority?.apply(operation);

      return { applied: !!authority, authority };
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
    }

    return { applied: false, authority };
  }

  /**
   * Tells, for each operation of `ordered` taken in that order, whether its
   * author still has quota left. The founder, who authors the genesis, has
   * none. An admission counts toward its admitter, like every operation.
   */
  private static quotaOf(
    ordered: readonly CommunityOperation[],
  ): (operation: CommunityOperation) => boolean {
    const signed = new Map<string, number>();
    const founder = ordered
      .find((operation) => operation.isGenesis())
      ?.getAuthorIdentityId();

    return (operation) => {
      const author = operation.getAuthorIdentityId();
      const count = signed.get(author) ?? 0;

      signed.set(author, count + 1);

      return author === founder || count < MAX_OPERATIONS_PER_AUTHOR;
    };
  }

  private static isLedgered(operation: CommunityOperation): boolean {
    return (
      LEDGERED_ACTIONS.includes(operation.getAction()) ||
      CommunityInvitation.isAdmission(operation)
    );
  }

  /** Whether the author of a revocation may close `invitation` in `past`. */
  private static mayRevoke(
    authority: CommunityAuthority,
    invitation: CommunityInvitation,
    author: string,
  ): boolean {
    return (
      invitation.isRevoked() === false &&
      ((invitation.getIssuerIdentityId() === author &&
        authority.isMember(author)) ||
        authority.hasPermission(author, 'manage_members'))
    );
  }

  /** Whether an admission is valid in `past`: the invitation lets it in. */
  private static admits(
    operation: CommunityOperation,
    past: CommunityOperationFoldState,
    authority: CommunityAuthority,
  ): boolean {
    const { consent, identityId, invitationId, possession } =
      operation.getArguments();
    const invitation = past.invitations.find(String(invitationId));

    if (
      !invitation ||
      !invitation.isOpenAt(operation.getCreatedAt()) ||
      typeof identityId !== 'string' ||
      typeof possession !== 'string' ||
      typeof consent !== 'string'
    ) {
      return false;
    }

    try {
      invitation.assertAdmits(authority, identityId, possession, consent);

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Whether `operation` is valid in its causal past, the state folded from
   * its parents: the community permits it and the invitations of that past
   * allow it. Operations that need no invitation are always valid here.
   */
  private static isStored(
    operation: CommunityOperation,
    pastOf: () => CommunityOperationFoldState,
  ): boolean {
    if (!CommunityOperationFold.isLedgered(operation)) return true;

    const past = pastOf();
    const { authority } = past;

    if (!authority) return false;

    try {
      authority.clone().apply(operation);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;

      return false;
    }

    const author = IdentityId.normalize(operation.getAuthorIdentityId());
    const action = operation.getAction();

    if (action === 'invitation_created') {
      return !past.invitations.findByKey(
        CommunityInvitation.fromOperation(operation).getInvitationKey(),
      );
    }

    if (action === 'invitation_revoked') {
      const invitation = past.invitations.find(
        String(operation.getArguments().invitationId),
      );

      return (
        !!invitation &&
        CommunityOperationFold.mayRevoke(authority, invitation, author)
      );
    }

    return CommunityOperationFold.admits(operation, past, authority);
  }

  /**
   * The state folded from the causal past of `operation`, remembered in
   * `pasts` per set of parents and shared by the operations built on it.
   */
  private static pastOf(
    ordered: readonly CommunityOperation[],
    operation: CommunityOperation,
    pasts: Map<string, CommunityOperationFoldState>,
  ): CommunityOperationFoldState {
    const parents = operation.getParents();
    const key = [...parents].sort().join(' ');
    let past = pasts.get(key);

    if (!past) {
      past = CommunityOperationFold.foldOf(
        CommunityOperationFold.closureOf(ordered, parents),
        pasts,
      );
      pasts.set(key, past);
    }

    return past;
  }

  /**
   * Whether `operation` is void by the authority cuts: an invitation or an
   * admission a standing cut reaches, or an admission under a void
   * invitation.
   */
  private static isVoid(
    operation: CommunityOperation,
    cuts: CommunityAuthorityCuts,
    byHash: ReadonlyMap<string, CommunityOperation>,
  ): boolean {
    if (cuts.isVoid(operation)) return true;

    const { invitationId } = operation.getArguments();
    const invitation =
      CommunityInvitation.isAdmission(operation) &&
      typeof invitationId === 'string'
        ? byHash.get(invitationId)
        : undefined;

    return !!invitation && cuts.isVoid(invitation);
  }

  private static foldOf(
    operations: readonly CommunityOperation[],
    pasts: Map<string, CommunityOperationFoldState>,
  ): CommunityOperationFoldState {
    const ordered = CommunityOperationFold.orderOf(operations);
    const byHash = new Map(
      ordered.map((operation) => [operation.getHash(), operation]),
    );
    const cuts = new CommunityAuthorityCuts(
      ordered,
      new CommunityOperationAncestry(ordered),
      (operation) =>
        CommunityAuthorityCuts.takenBy(
          CommunityOperationFold.pastOf(ordered, operation, pasts).authority,
          operation,
        ),
    );
    const withinQuota = CommunityOperationFold.quotaOf(ordered);
    const skipped: string[] = [];
    let authority: CommunityAuthority | undefined;
    let invitations = CommunityInvitations.EMPTY;

    for (const operation of ordered) {
      // A valid admission counts as a use even when the linear fold skips it.
      const stored = CommunityOperationFold.isStored(operation, () =>
        CommunityOperationFold.pastOf(ordered, operation, pasts),
      );
      const proceeds =
        withinQuota(operation) &&
        stored &&
        !authority?.isDeleted() &&
        !CommunityOperationFold.isVoid(operation, cuts, byHash);
      const result = proceeds
        ? CommunityOperationFold.applied(authority, operation)
        : { applied: false, authority };

      authority = result.authority;

      if (!result.applied) skipped.push(operation.getHash());

      invitations = invitations.after(operation, result.applied, stored);
    }

    return {
      authority: authority?.isDeleted() ? undefined : authority,
      invitations: invitations.cutWhere((invitation) =>
        cuts.cutsIssuerOf(invitation),
      ),
      skipped,
    };
  }

  /**
   * Parents first; the lowest digest first among the ready operations. An
   * operation with an unknown parent never gets ready, nor do its children.
   */
  public static orderOf(
    operations: readonly CommunityOperation[],
  ): CommunityOperation[] {
    const pending = new Map(
      operations.map((operation) => [operation.getHash(), operation]),
    );
    const waiting = new Map(
      [...pending].map(([hash, operation]) => [
        hash,
        new Set(operation.getParents()),
      ]),
    );
    const children = new Map<string, string[]>();

    for (const [hash, operation] of pending) {
      for (const parent of operation.getParents()) {
        const siblings = children.get(parent) ?? [];

        siblings.push(hash);
        children.set(parent, siblings);
      }
    }

    const ready = [...waiting]
      .filter(([, parents]) => parents.size === 0)
      .map(([hash]) => hash)
      .sort();
    const ordered: CommunityOperation[] = [];

    while (ready.length > 0) {
      const hash = ready.shift() as string;

      ordered.push(pending.get(hash) as CommunityOperation);

      for (const child of children.get(hash) ?? []) {
        const parents = waiting.get(child) as Set<string>;

        parents.delete(hash);

        if (parents.size === 0) ready.push(child);
      }

      ready.sort();
    }

    return ordered;
  }

  /** Operations in the causal past of `parents`, inclusive. */
  public static closureOf(
    operations: readonly CommunityOperation[],
    parents: readonly string[],
  ): CommunityOperation[] {
    const known = new Map(
      operations.map((operation) => [operation.getHash(), operation]),
    );
    const closure = new Map<string, CommunityOperation>();
    const stack = [...parents];

    while (stack.length > 0) {
      const hash = stack.pop() as string;
      const operation = known.get(hash);

      assert(operation, new CommunityOperationRejectedError());

      if (!closure.has(hash)) {
        closure.set(hash, operation as CommunityOperation);
        stack.push(...(operation as CommunityOperation).getParents());
      }
    }

    return [...closure.values()];
  }

  /** What `operations` prove: authority, invitations and what was skipped. */
  public static state(
    operations: readonly CommunityOperation[],
  ): CommunityOperationFoldState {
    return CommunityOperationFold.foldOf(operations, new Map());
  }

  /**
   * The authority `operations` prove, or `undefined` when they hold no
   * genesis or the community was deleted: then no one holds any right.
   */
  public static fold(
    operations: readonly CommunityOperation[],
  ): CommunityAuthority | undefined {
    return CommunityOperationFold.state(operations).authority;
  }
}
