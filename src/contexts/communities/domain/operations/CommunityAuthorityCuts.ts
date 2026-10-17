import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { CommunityInvitation } from '../entities/invitations/CommunityInvitation';
import { CommunityAuthority } from './CommunityAuthority';
import { CommunityCutComponents } from './CommunityCutComponents';
import { CommunityOperation } from './CommunityOperation';
import { CommunityOperationAncestry } from './CommunityOperationAncestry';

/** What one cut takes: `<authority> <identityId>` for each authority lost. */
export type CommunityAuthorityTaken = ReadonlySet<string>;

/**
 * The authority cuts of one set of operations `S`.
 *
 * An operation `D` **cuts** an authority of member `X` (its membership, or a
 * permission some operation needs) when `X` holds it in `past(D)`, the
 * community folded from the causal past of `D`, and does not once `D` is
 * applied there. Only kicks, bans, leaves and role changes cut; what they
 * take is decided from `D` and its causal past alone (`takenBy`).
 *
 * The cuts form a graph with an edge from `D` to `E` when they are concurrent
 * and `D` takes what `E` needs of its author. Its strongly connected
 * components are visited in topological order: a cut is void when a standing
 * cut of an earlier component reaches it and takes what it needs, and stands
 * otherwise. Cuts of one component never void each other.
 *
 * A standing cut reaches the operations it is concurrent with. A cut of a
 * cycle (a component of more than one cut) never reaches what its author
 * built on: an operation in the closure of one its author signed without the
 * cut in its closure.
 *
 * A void cut takes nothing here, but the linear fold still applies it. Only
 * invitations and admissions are ever void (`isVoid`). The founder holds
 * every authority by ownership, so nothing cuts it.
 */
export class CommunityAuthorityCuts {
  private static readonly MEMBERSHIP = 'membership';

  /** What each cutting action needs of its author. */
  private static readonly CUT_NEEDS: Record<string, string> = {
    member_banned: 'ban_members',
    member_kicked: 'manage_members',
    member_left: CommunityAuthorityCuts.MEMBERSHIP,
    member_roles_updated: 'manage_roles',
    role_deleted: 'manage_roles',
    role_updated: 'manage_roles',
  };

  /** The permissions some cut, invitation or admission needs. */
  private static readonly PERMISSIONS = [
    'ban_members',
    'create_invites',
    'manage_members',
    'manage_roles',
  ];

  private static readonly NOTHING: CommunityAuthorityTaken = new Set();

  private readonly authored = new Map<string, CommunityOperation[]>();

  /** What each cut of `S` takes, for the cuts that take something. */
  private readonly taken = new Map<string, CommunityAuthorityTaken>();

  /** The cuts of `S` by each identity they take something from. */
  private readonly cutsOf = new Map<string, CommunityOperation[]>();

  private readonly cyclic = new Set<string>();

  private readonly standing = new Set<string>();

  private readonly spared = new Map<string, Set<string>>();

  private static keyOf(authority: string, identityId: string): string {
    return `${authority} ${identityId}`;
  }

  private static authorOf(operation: CommunityOperation): string {
    return IdentityId.normalize(operation.getAuthorIdentityId());
  }

  private static isCutting(operation: CommunityOperation): boolean {
    return Object.prototype.hasOwnProperty.call(
      CommunityAuthorityCuts.CUT_NEEDS,
      operation.getAction(),
    );
  }

  /** What `operation` needs of its author, when a cut can void it. */
  private static needOf(operation: CommunityOperation): string | undefined {
    const action = operation.getAction();

    if (CommunityAuthorityCuts.isCutting(operation)) {
      return CommunityAuthorityCuts.CUT_NEEDS[action];
    }

    if (action === 'invitation_created') return 'create_invites';

    return CommunityInvitation.isAdmission(operation)
      ? 'manage_members'
      : undefined;
  }

  /**
   * What `operation` takes when applied to `past`, the community folded from
   * its causal past; nothing for an operation that cuts nothing or that
   * `past` does not permit.
   */
  public static takenBy(
    past: CommunityAuthority | undefined,
    operation: CommunityOperation,
  ): CommunityAuthorityTaken {
    if (!past || !CommunityAuthorityCuts.isCutting(operation)) {
      return CommunityAuthorityCuts.NOTHING;
    }

    const after = past.clone();

    try {
      after.apply(operation);
    } catch {
      return CommunityAuthorityCuts.NOTHING;
    }

    return CommunityAuthorityCuts.takenBetween(past, after);
  }

  /** What the members of `before` lost in `after`. */
  public static takenBetween(
    before: CommunityAuthority,
    after: CommunityAuthority,
  ): CommunityAuthorityTaken {
    const taken = new Set<string>();

    for (const member of before.getMemberIds()) {
      if (!after.isMember(member)) {
        taken.add(
          CommunityAuthorityCuts.keyOf(
            CommunityAuthorityCuts.MEMBERSHIP,
            member,
          ),
        );
      }

      for (const permission of CommunityAuthorityCuts.PERMISSIONS) {
        if (
          before.hasPermission(member, permission) &&
          !after.hasPermission(member, permission)
        ) {
          taken.add(CommunityAuthorityCuts.keyOf(permission, member));
        }
      }
    }

    return taken;
  }

  /** Whether `taken` holds `create_invites` or the membership of `issuer`. */
  public static takesInvitesOf(
    taken: CommunityAuthorityTaken,
    issuer: string,
  ): boolean {
    return (
      taken.has(CommunityAuthorityCuts.keyOf('create_invites', issuer)) ||
      taken.has(
        CommunityAuthorityCuts.keyOf(CommunityAuthorityCuts.MEMBERSHIP, issuer),
      )
    );
  }

  /**
   * `ordered` is `S` with parents first; `takenOf` tells what a cutting
   * operation of `S` takes at its causal past.
   */
  public constructor(
    ordered: CommunityOperation[],
    private readonly ancestry: CommunityOperationAncestry,
    takenOf: (operation: CommunityOperation) => CommunityAuthorityTaken,
  ) {
    for (const operation of ordered) {
      const author = CommunityAuthorityCuts.authorOf(operation);

      this.authored.set(author, [
        ...(this.authored.get(author) ?? []),
        operation,
      ]);
    }

    for (const operation of ordered) {
      if (!this.matters(operation)) continue;

      const taken = takenOf(operation);

      if (taken.size === 0) continue;

      this.taken.set(operation.getHash(), taken);

      for (const member of new Set(
        [...taken].map((key) => key.slice(key.indexOf(' ') + 1)),
      )) {
        this.cutsOf.set(member, [
          ...(this.cutsOf.get(member) ?? []),
          operation,
        ]);
      }
    }

    this.decide(
      ordered.filter((operation) => this.taken.has(operation.getHash())),
    );
  }

  /**
   * Whether what a cutting `operation` takes can change anything in `S`:
   * some operation of a member it may cut needs an authority and is either
   * concurrent with it or an invitation it is not in the closure of. A role
   * change may cut any member, so it always matters.
   */
  private matters(operation: CommunityOperation): boolean {
    const action = operation.getAction();

    if (!CommunityAuthorityCuts.isCutting(operation)) return false;

    if (action === 'role_updated' || action === 'role_deleted') return true;

    const { identityId } = operation.getArguments();
    const target =
      action === 'member_left'
        ? CommunityAuthorityCuts.authorOf(operation)
        : identityId;
    const hash = operation.getHash();

    return (
      typeof target === 'string' &&
      (this.authored.get(IdentityId.normalize(target)) ?? []).some(
        (other) =>
          CommunityAuthorityCuts.needOf(other) !== undefined &&
          (this.ancestry.areConcurrent(hash, other.getHash()) ||
            (other.getAction() === 'invitation_created' &&
              !this.ancestry.isAncestor(hash, other.getHash()))),
      )
    );
  }

  /** Whether `cut` took `authority` of `identityId`. */
  private takes(
    cut: CommunityOperation,
    authority: string,
    identityId: string,
  ): boolean {
    return !!this.taken
      .get(cut.getHash())
      ?.has(CommunityAuthorityCuts.keyOf(authority, identityId));
  }

  /** The operations in the closure of one `cut`'s author signed without it. */
  private sparedBy(cut: CommunityOperation): Set<string> {
    const hash = cut.getHash();
    let spared = this.spared.get(hash);

    if (!spared) {
      spared = this.ancestry.closureOf(
        (this.authored.get(CommunityAuthorityCuts.authorOf(cut)) ?? [])
          .map((operation) => operation.getHash())
          .filter(
            (signed) =>
              signed !== hash && !this.ancestry.isAncestor(hash, signed),
          ),
      );
      this.spared.set(hash, spared);
    }

    return spared;
  }

  private reaches(
    cut: CommunityOperation,
    operation: CommunityOperation,
  ): boolean {
    return (
      this.ancestry.areConcurrent(cut.getHash(), operation.getHash()) &&
      (!this.cyclic.has(cut.getHash()) ||
        !this.sparedBy(cut).has(operation.getHash()))
    );
  }

  /** Whether a standing cut reaches `operation` and takes `need` of it. */
  private isReachedBy(operation: CommunityOperation, need: string): boolean {
    const author = CommunityAuthorityCuts.authorOf(operation);

    return (this.cutsOf.get(author) ?? []).some(
      (cut) =>
        this.standing.has(cut.getHash()) &&
        this.takes(cut, need, author) &&
        this.reaches(cut, operation),
    );
  }

  /** The concurrent cuts that take what `cut` needs of its author. */
  private predecessorsOf(cut: CommunityOperation): CommunityOperation[] {
    const author = CommunityAuthorityCuts.authorOf(cut);
    const need = CommunityAuthorityCuts.needOf(cut) as string;

    return (this.cutsOf.get(author) ?? []).filter(
      (other) =>
        other !== cut &&
        this.takes(other, need, author) &&
        this.ancestry.areConcurrent(other.getHash(), cut.getHash()),
    );
  }

  /**
   * The cuts of one `component` stand unless a standing cut of an earlier
   * component reaches them and takes what they need.
   */
  private decideComponent(
    component: string[],
    byHash: ReadonlyMap<string, CommunityOperation>,
    predecessors: ReadonlyMap<string, CommunityOperation[]>,
  ): void {
    const members = new Set(component);

    if (component.length > 1) {
      component.forEach((hash) => this.cyclic.add(hash));
    }

    for (const hash of component) {
      const cut = byHash.get(hash) as CommunityOperation;
      const voided = (predecessors.get(hash) ?? []).some(
        (other) =>
          !members.has(other.getHash()) &&
          this.standing.has(other.getHash()) &&
          this.reaches(other, cut),
      );

      if (!voided) this.standing.add(hash);
    }
  }

  /** Builds the cut graph of `cuts` and decides which cuts stand. */
  private decide(cuts: CommunityOperation[]): void {
    const byHash = new Map(cuts.map((cut) => [cut.getHash(), cut]));
    const predecessors = new Map(
      cuts.map((cut) => [cut.getHash(), this.predecessorsOf(cut)]),
    );
    const successors = new Map<string, string[]>();

    for (const [hash, incoming] of predecessors) {
      for (const other of incoming) {
        successors.set(other.getHash(), [
          ...(successors.get(other.getHash()) ?? []),
          hash,
        ]);
      }
    }

    for (const component of CommunityCutComponents.of(
      [...byHash.keys()],
      successors,
    )) {
      this.decideComponent(component, byHash, predecessors);
    }
  }

  /**
   * Whether an invitation or an admission is void in `S`: a standing cut
   * reaches it and takes `create_invites` of the issuer or `manage_members`
   * of the admitter. Nothing else is ever void.
   */
  public isVoid(operation: CommunityOperation): boolean {
    const need = CommunityAuthorityCuts.isCutting(operation)
      ? undefined
      : CommunityAuthorityCuts.needOf(operation);

    return need !== undefined && this.isReachedBy(operation, need);
  }

  /**
   * Whether a standing cut outside the closure of `invitation` took
   * `create_invites` or the membership of its issuer: the invitation is dead
   * for every later admission, even after the issuer is promoted again.
   */
  public cutsIssuerOf(invitation: CommunityInvitation): boolean {
    const issuer = invitation.getIssuerIdentityId();

    return (this.cutsOf.get(issuer) ?? []).some(
      (cut) =>
        this.standing.has(cut.getHash()) &&
        CommunityAuthorityCuts.takesInvitesOf(
          this.taken.get(cut.getHash()) as CommunityAuthorityTaken,
          issuer,
        ) &&
        !this.ancestry.isAncestor(cut.getHash(), invitation.getId()),
    );
  }
}
