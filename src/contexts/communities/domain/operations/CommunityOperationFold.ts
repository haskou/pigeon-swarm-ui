import { DomainError } from '@haskou/value-objects';

import type { CommunityOperation } from './CommunityOperation';

import { CommunityAuthority } from './CommunityAuthority';

/** Operations one identity other than the founder signs in one community. */
const MAX_OPERATIONS_PER_AUTHOR = 1_000;

/**
 * The authority a community's signed operations prove, folded exactly as the
 * nodes fold them: parents first and the lowest digest first among concurrent
 * operations, each one authorised again against the state it applies to, the
 * operations beyond an author's quota skipped, nothing applied once the
 * community has no members left. An operation whose parents are not all
 * known proves nothing, nor does anything built on it.
 */
export class CommunityOperationFold {
  /**
   * Parents first; the lowest digest first among the ready operations. An
   * operation with an unknown parent never gets ready, nor do its children.
   */
  private static orderOf(
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

  /**
   * `authority` after `operation`, or as it was when its state does not allow
   * the operation: such an operation proves nothing.
   */
  private static applied(
    authority: CommunityAuthority | undefined,
    operation: CommunityOperation,
  ): CommunityAuthority | undefined {
    try {
      if (operation.isGenesis()) {
        return authority ?? CommunityAuthority.create(operation);
      }

      authority?.apply(operation);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
    }

    return authority;
  }

  /**
   * The authority `operations` prove, or `undefined` when they hold no
   * genesis or the community was deleted: then no one holds any right.
   */
  public static fold(
    operations: readonly CommunityOperation[],
  ): CommunityAuthority | undefined {
    const ordered = CommunityOperationFold.orderOf(operations);
    const founder = ordered
      .find((operation) => operation.isGenesis())
      ?.getAuthorIdentityId();
    const signed = new Map<string, number>();
    let authority: CommunityAuthority | undefined;

    for (const operation of ordered) {
      const author = operation.getAuthorIdentityId();
      const count = signed.get(author) ?? 0;

      signed.set(author, count + 1);

      if (
        (author === founder || count < MAX_OPERATIONS_PER_AUTHOR) &&
        !authority?.isDeleted()
      ) {
        authority = CommunityOperationFold.applied(authority, operation);
      }
    }

    return authority?.isDeleted() ? undefined : authority;
  }
}
