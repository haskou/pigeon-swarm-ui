import { assert } from '@haskou/value-objects';

import type { CommunityChannelGrant } from './CommunityChannelGrant';
import type { CommunityOperation } from './CommunityOperation';
import type { CommunityRoleGrant } from './CommunityRoleGrant';

import { IdentityId } from '../../../identities/domain/value-objects/IdentityId';
import { CommunityOperationRejectedError } from '../errors/CommunityOperationRejectedError';
import { CommunityChannelId } from '../value-objects/CommunityChannelId';
import { CommunityChannelName } from '../value-objects/CommunityChannelName';
import { CommunityDescription } from '../value-objects/CommunityDescription';
import { CommunityName } from '../value-objects/CommunityName';
import { CommunityPermission } from '../value-objects/CommunityPermission';
import { CommunityRoleId } from '../value-objects/CommunityRoleId';
import { CommunityRoleName } from '../value-objects/CommunityRoleName';
import { CommunityVisibility } from '../value-objects/CommunityVisibility';

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

/**
 * Who holds which right in one community, as its signed operations prove it.
 * It replays the node's rules for membership and roles, so an operation is
 * applied only when the state built from the operations before it allows its
 * author to make it. Whatever no signed operation proves is absent.
 */
export class CommunityAuthority {
  private readonly assignments = new Map<string, string[]>();
  private readonly banned: string[] = [];
  private readonly channels: CommunityChannelGrant[] = [];
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

  /** A channel name as the node takes it: any string of up to 80 chars. */
  private static channelName(value: unknown): void {
    assert(
      CommunityAuthority.text(value).length <= CommunityChannelName.MAX_LENGTH,
      new CommunityOperationRejectedError(),
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
    const visibility = CommunityVisibility.fromPrimitives(
      CommunityAuthority.text(args.visibility),
    );

    for (const key of ['avatar', 'banner'] as const) {
      if (args[key] !== undefined) CommunityAuthority.text(args[key]);
    }

    return new CommunityAuthority(
      genesis,
      CommunityAuthority.flag(args.autoJoinEnabled),
      visibility,
    );
  }

  private constructor(
    genesis: CommunityOperation,
    private autoJoinEnabled: boolean,
    private readonly visibility: CommunityVisibility,
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

  private channel(channelId: string): CommunityChannelGrant | undefined {
    return this.channels.find((channel) => channel.id === channelId);
  }

  /** The existing channel `channelId` names, for a channel manager. */
  private managedChannel(
    author: string,
    channelId: unknown,
  ): CommunityChannelGrant {
    const channel = this.channel(CommunityAuthority.text(channelId));

    this.require(this.hasPermission(author, 'manage_channels') && !!channel);

    return channel as CommunityChannelGrant;
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

  private createChannel(operation: CommunityOperation): void {
    const author = operation.getAuthorIdentityId();
    const args = CommunityAuthority.read(operation.getArguments(), [
      'channelId',
      'name',
      'type',
    ]);
    const channelId = CommunityAuthority.text(args.channelId);
    const type = CommunityAuthority.text(args.type);

    CommunityAuthority.channelName(args.name);
    this.require(
      channelId ===
        CommunityChannelId.derive(
          this.communityId,
          author,
          operation.getCreatedAt(),
        ).valueOf() &&
        (type === 'text' || type === 'voice') &&
        this.hasPermission(author, 'manage_channels'),
    );
    this.channels.push({ id: channelId, visibleRoleIds: [EVERYONE] });
  }

  private renameChannel(
    author: string,
    args: Readonly<Record<string, unknown>>,
  ): void {
    const read = CommunityAuthority.read(args, ['channelId', 'name']);

    CommunityAuthority.channelName(read.name);
    this.managedChannel(author, read.channelId);
  }

  private deleteChannel(
    author: string,
    args: Readonly<Record<string, unknown>>,
  ): void {
    const channel = this.managedChannel(
      author,
      CommunityAuthority.read(args, ['channelId']).channelId,
    );

    this.channels.splice(this.channels.indexOf(channel), 1);
  }

  /** Who may see the channel; no role at all means everyone. */
  private updateChannelPermissions(
    author: string,
    args: Readonly<Record<string, unknown>>,
  ): void {
    const read = CommunityAuthority.read(args, ['channelId', 'visibleRoleIds']);
    const visibleRoleIds = CommunityAuthority.texts(read.visibleRoleIds);
    const channel = this.managedChannel(author, read.channelId);

    channel.visibleRoleIds =
      visibleRoleIds.length > 0 ? [...visibleRoleIds] : [EVERYONE];
  }

  /** How each action that changes the authority applies `operation`. */
  private handlersFor(
    operation: CommunityOperation,
  ): Record<string, () => void> {
    const author = operation.getAuthorIdentityId();
    const args = operation.getArguments();
    const member = (): string => CommunityAuthority.member(args);

    return {
      channel_created: () => this.createChannel(operation),
      channel_deleted: () => this.deleteChannel(author, args),
      channel_permissions_updated: () =>
        this.updateChannelPermissions(author, args),
      channel_renamed: () => this.renameChannel(author, args),
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
   * Whether the identity would see a channel only `visibleRoleIds` may see:
   * the owner always, a member when `everyone` or one of its roles is there.
   */
  private canSeeRoles(
    identityId: string,
    visibleRoleIds: readonly string[],
  ): boolean {
    return (
      this.isMember(identityId) &&
      (identityId === this.ownerId ||
        [EVERYONE, ...(this.assignments.get(identityId) ?? [])].some((roleId) =>
          visibleRoleIds.includes(roleId),
        ))
    );
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
        operation.getNetworkId() === this.networkId &&
        Object.prototype.hasOwnProperty.call(handlers, action),
    );
    handlers[action]();
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

  /** The visibility its genesis signs; no operation changes it. */
  public getVisibility(): CommunityVisibility {
    return this.visibility;
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

  /**
   * Whether the identity may key a channel only `visibleRoleIds` may see:
   * its own group needs a first member that may add the others and keeps
   * seeing it. Opening a channel to everyone (or to no role) needs no key.
   */
  public canKeyRestrictedChannel(
    identityId: string,
    visibleRoleIds: readonly string[],
  ): boolean {
    return (
      visibleRoleIds.length === 0 ||
      visibleRoleIds.includes(EVERYONE) ||
      (this.hasPermission(identityId, 'manage_members') &&
        this.canSeeRoles(identityId, visibleRoleIds))
    );
  }

  /**
   * Whether the identity may see the channel, as `canSeeRoles`; no one sees
   * a channel the signed operations do not hold.
   */
  public canAccessChannel(identityId: string, channelId: string): boolean {
    const channel = this.channel(channelId);

    return !!channel && this.canSeeRoles(identityId, channel.visibleRoleIds);
  }

  /** Whether only some roles may see the channel. */
  public isChannelRestricted(channelId: string): boolean {
    const channel = this.channel(channelId);

    return !!channel && !channel.visibleRoleIds.includes(EVERYONE);
  }

  public getRestrictedChannelIds(): string[] {
    return this.channels
      .filter((channel) => !channel.visibleRoleIds.includes(EVERYONE))
      .map((channel) => channel.id);
  }
}
