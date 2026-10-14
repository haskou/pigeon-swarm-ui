import { assert } from '@haskou/value-objects';

import type { CommunityOperation } from './CommunityOperation';
import type { CommunityRoleGrant } from './CommunityRoleGrant';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { CommunityOperationRejectedError } from '../errors/CommunityOperationRejectedError';
import { CommunityDescription } from '../value-objects/CommunityDescription';
import { CommunityName } from '../value-objects/CommunityName';
import { CommunityPermission } from '../value-objects/CommunityPermission';
import { CommunityRoleId } from '../value-objects/CommunityRoleId';
import { CommunityRoleName } from '../value-objects/CommunityRoleName';

const EVERYONE = 'everyone';
/** What the built-in `everyone` role allows until a manager changes it. */
const BASIC_MEMBER_PERMISSIONS = [
  'attach_files',
  'connect_voice',
  'embed_links',
  'send_messages',
  'send_stickers',
  'view_channels',
];
/**
 * How an identity may join, and the permission the author needs: a self join
 * is signed by the joiner, `automatic` needs auto join to be enabled.
 */
const JOIN_METHODS: Record<
  string,
  { permission?: string; reference: boolean; selfJoin: boolean }
> = {
  added: { permission: 'manage_members', reference: false, selfJoin: false },
  approval: { permission: 'approve_members', reference: true, selfJoin: false },
  automatic: { reference: false, selfJoin: true },
  invitation: { reference: true, selfJoin: true },
  invite_link: { reference: true, selfJoin: true },
};
/** Actions that change nothing the authority holds; channels are not roles. */
const OTHER_ACTIONS: Record<string, true> = {
  channel_created: true,
  channel_deleted: true,
  channel_permissions_updated: true,
  channel_renamed: true,
};

/**
 * Who holds which right in one community, as its signed operations prove it.
 * It replays the node's rules for membership and roles, so an operation is
 * applied only when the state built from the operations before it allows its
 * author to make it. Whatever no signed operation proves is absent.
 */
export class CommunityAuthority {
  private readonly assignments = new Map<string, string[]>();
  private readonly banned: string[] = [];
  private readonly communityId: string;
  private readonly members: string[];
  private readonly networkId: string;
  private readonly ownerId: string;
  private readonly roles: CommunityRoleGrant[] = [
    { builtIn: true, id: EVERYONE, permissions: BASIC_MEMBER_PERMISSIONS },
  ];

  /** The exact keys of `args`; a signed operation smuggles nothing else. */
  private static read(
    args: Readonly<Record<string, unknown>>,
    required: readonly string[],
    optional: readonly string[] = [],
  ): Readonly<Record<string, unknown>> {
    const keys = Object.keys(args);

    assert(
      required.every((key) => keys.includes(key)) &&
        keys.every((key) => required.includes(key) || optional.includes(key)),
      new CommunityOperationRejectedError(),
    );

    return args;
  }

  private static text(value: unknown): string {
    assert(typeof value === 'string', new CommunityOperationRejectedError());

    return value as string;
  }

  private static texts(value: unknown): string[] {
    assert(
      Array.isArray(value) && value.every((entry) => typeof entry === 'string'),
      new CommunityOperationRejectedError(),
    );

    return value as string[];
  }

  private static flag(value: unknown): boolean {
    assert(typeof value === 'boolean', new CommunityOperationRejectedError());

    return value as boolean;
  }

  /** An identity, in the one form the node compares identities in. */
  private static identity(value: unknown): string {
    return IdentityId.normalize(CommunityAuthority.text(value));
  }

  /** The `identityId`, the only argument of a member change. */
  private static member(args: Readonly<Record<string, unknown>>): string {
    return CommunityAuthority.identity(
      CommunityAuthority.read(args, ['identityId']).identityId,
    );
  }

  private static permissions(value: unknown): string[] {
    return CommunityAuthority.texts(value).map((permission) =>
      CommunityPermission.fromPrimitives(permission).valueOf(),
    );
  }

  /** The community its genesis operation creates; throws when malformed. */
  public static create(genesis: CommunityOperation): CommunityAuthority {
    assert(genesis.isGenesis(), new CommunityOperationRejectedError());
    const args = CommunityAuthority.read(
      genesis.getArguments(),
      [
        'autoJoinEnabled',
        'description',
        'discoverable',
        'name',
        'nonce',
        'visibility',
      ],
      ['avatar', 'banner'],
    );

    CommunityName.fromString(CommunityAuthority.text(args.name));
    CommunityDescription.fromString(CommunityAuthority.text(args.description));
    CommunityAuthority.flag(args.discoverable);
    CommunityAuthority.text(args.nonce);
    CommunityAuthority.text(args.visibility);

    for (const key of ['avatar', 'banner'] as const) {
      if (args[key] !== undefined) CommunityAuthority.text(args[key]);
    }

    return new CommunityAuthority(
      genesis,
      CommunityAuthority.flag(args.autoJoinEnabled),
    );
  }

  private constructor(
    genesis: CommunityOperation,
    private autoJoinEnabled: boolean,
  ) {
    this.communityId = genesis.getCommunityId();
    this.networkId = genesis.getNetworkId();
    this.ownerId = genesis.getAuthorIdentityId();
    this.members = [this.ownerId];
  }

  private isMember(identityId: string): boolean {
    return this.members.includes(identityId);
  }

  private role(roleId: string): CommunityRoleGrant | undefined {
    return this.roles.find((role) => role.id === roleId);
  }

  private require(condition: boolean): void {
    assert(condition, new CommunityOperationRejectedError());
  }

  private remove(identityId: string): void {
    this.members.splice(this.members.indexOf(identityId), 1);
    this.assignments.delete(identityId);
  }

  private join(author: string, args: Readonly<Record<string, unknown>>): void {
    const { identityId, method, reference } = CommunityAuthority.read(
      args,
      ['identityId', 'method'],
      ['reference'],
    );
    const member = CommunityAuthority.identity(identityId);
    const name = CommunityAuthority.text(method);

    this.require(Object.keys(JOIN_METHODS).includes(name));
    const rule = JOIN_METHODS[name];

    this.require((reference !== undefined) === rule.reference);

    if (reference !== undefined) CommunityAuthority.text(reference);

    this.require(this.mayJoin(author, member, name));

    if (!this.isMember(member)) this.members.push(member);
  }

  /** Whether `author` may make `member` join by the method `name`. */
  private mayJoin(author: string, member: string, name: string): boolean {
    const rule = JOIN_METHODS[name];

    return (
      (!rule.selfJoin || author === member) &&
      (rule.permission === undefined ||
        this.hasPermission(author, rule.permission)) &&
      (name !== 'automatic' || this.autoJoinEnabled) &&
      !this.banned.includes(member)
    );
  }

  private leave(author: string, member: string): void {
    this.require(
      author === member &&
        this.isMember(member) &&
        (member !== this.ownerId || this.members.length === 1),
    );
    this.remove(member);
  }

  private kick(author: string, member: string): void {
    this.require(
      this.hasPermission(author, 'manage_members') &&
        this.isMember(member) &&
        member !== this.ownerId,
    );
    this.remove(member);
  }

  private ban(author: string, member: string): void {
    this.require(
      this.hasPermission(author, 'ban_members') && member !== this.ownerId,
    );

    if (!this.banned.includes(member)) this.banned.push(member);

    if (this.isMember(member)) this.remove(member);
  }

  private unban(author: string, member: string): void {
    this.require(this.hasPermission(author, 'ban_members'));

    if (this.banned.includes(member)) {
      this.banned.splice(this.banned.indexOf(member), 1);
    }
  }

  private createRole(operation: CommunityOperation): void {
    const author = operation.getAuthorIdentityId();
    const args = CommunityAuthority.read(operation.getArguments(), [
      'name',
      'permissions',
      'roleId',
    ]);
    const roleId = CommunityAuthority.text(args.roleId);

    CommunityRoleName.fromString(CommunityAuthority.text(args.name));
    const permissions = CommunityAuthority.permissions(args.permissions);

    this.require(
      roleId ===
        CommunityRoleId.derive(
          this.communityId,
          author,
          operation.getCreatedAt(),
        ).valueOf() && this.hasPermission(author, 'manage_roles'),
    );
    this.roles.push({ builtIn: false, id: roleId, permissions });
  }

  private updateRole(
    author: string,
    args: Readonly<Record<string, unknown>>,
  ): void {
    const read = CommunityAuthority.read(args, [
      'name',
      'permissions',
      'roleId',
    ]);

    CommunityRoleName.fromString(CommunityAuthority.text(read.name));
    const permissions = CommunityAuthority.permissions(read.permissions);
    const role = this.role(CommunityAuthority.text(read.roleId));

    this.require(this.hasPermission(author, 'manage_roles') && !!role);
    (role as CommunityRoleGrant).permissions = permissions;
  }

  private deleteRole(
    author: string,
    args: Readonly<Record<string, unknown>>,
  ): void {
    const roleId = CommunityAuthority.text(
      CommunityAuthority.read(args, ['roleId']).roleId,
    );
    const role = this.role(roleId);

    this.require(
      this.hasPermission(author, 'manage_roles') && !!role && !role.builtIn,
    );
    this.roles.splice(this.roles.indexOf(role as CommunityRoleGrant), 1);

    for (const [identityId, roleIds] of this.assignments) {
      this.assignments.set(
        identityId,
        roleIds.filter((assigned) => assigned !== roleId),
      );
    }
  }

  private assignRoles(
    author: string,
    args: Readonly<Record<string, unknown>>,
  ): void {
    const read = CommunityAuthority.read(args, ['identityId', 'roleIds']);
    const member = CommunityAuthority.identity(read.identityId);
    const roleIds = CommunityAuthority.texts(read.roleIds);

    this.require(
      this.hasPermission(author, 'manage_roles') &&
        this.isMember(member) &&
        roleIds.every((roleId) => this.role(roleId) !== undefined),
    );
    this.assignments.set(
      member,
      roleIds.filter((roleId) => roleId !== EVERYONE),
    );
  }

  private updateProfile(
    author: string,
    args: Readonly<Record<string, unknown>>,
  ): void {
    const read = CommunityAuthority.read(
      args,
      ['description', 'name'],
      ['autoJoinEnabled', 'avatar', 'banner', 'discoverable'],
    );

    CommunityName.fromString(CommunityAuthority.text(read.name));
    CommunityDescription.fromString(CommunityAuthority.text(read.description));

    for (const key of ['avatar', 'banner'] as const) {
      if (read[key] !== undefined) CommunityAuthority.text(read[key]);
    }

    if (read.discoverable !== undefined) {
      CommunityAuthority.flag(read.discoverable);
    }

    const autoJoinEnabled =
      read.autoJoinEnabled === undefined
        ? undefined
        : CommunityAuthority.flag(read.autoJoinEnabled);

    this.require(author === this.ownerId);
    this.autoJoinEnabled = autoJoinEnabled ?? this.autoJoinEnabled;
  }

  /** How each action that changes the authority applies `operation`. */
  private handlersFor(
    operation: CommunityOperation,
  ): Record<string, () => void> {
    const author = operation.getAuthorIdentityId();
    const args = operation.getArguments();
    const member = (): string => CommunityAuthority.member(args);

    return {
      community_updated: () => this.updateProfile(author, args),
      member_banned: () => this.ban(author, member()),
      member_joined: () => this.join(author, args),
      member_kicked: () => this.kick(author, member()),
      member_left: () => this.leave(author, member()),
      member_roles_updated: () => this.assignRoles(author, args),
      member_unbanned: () => this.unban(author, member()),
      role_created: () => this.createRole(operation),
      role_deleted: () => this.deleteRole(author, args),
      role_updated: () => this.updateRole(author, args),
    };
  }

  /**
   * Applies one operation of this community, or throws and changes nothing
   * when the state does not allow its author to make it.
   */
  public apply(operation: CommunityOperation): void {
    const action = operation.getAction();
    const handlers = this.handlersFor(operation);

    this.require(
      !operation.isGenesis() &&
        operation.getCommunityId() === this.communityId &&
        operation.getNetworkId() === this.networkId,
    );

    if (Object.prototype.hasOwnProperty.call(handlers, action)) {
      handlers[action]();
    } else {
      this.require(OTHER_ACTIONS[action] === true);
    }
  }

  /** Whether no one is left: a deleted community takes no more operations. */
  public isDeleted(): boolean {
    return this.members.length === 0;
  }

  public getOwnerIdentityId(): string {
    return this.ownerId;
  }

  /** The members; a banned identity is never one. */
  public getMemberIds(): string[] {
    return [...this.members];
  }

  /**
   * Whether the identity holds the permission: the owner holds all of them,
   * a member those of `everyone` and of its roles, anyone else none.
   */
  public hasPermission(identityId: string, permission: string): boolean {
    return (
      identityId === this.ownerId ||
      (this.isMember(identityId) &&
        [EVERYONE, ...(this.assignments.get(identityId) ?? [])].some((roleId) =>
          this.role(roleId)?.permissions.includes(permission),
        ))
    );
  }
}
