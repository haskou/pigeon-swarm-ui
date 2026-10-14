import {
  type AuthenticationService,
  type PrivateMessage,
  type ClientConfig,
  type ClientState,
  type CiphersuiteImpl,
  type IncomingMessageAction,
  type IncomingMessageCallback,
  type KeyPackage,
  type Proposal,
  type PrivateKeyPackage,
  createApplicationMessage,
  createCommit,
  createGroup,
  decodeGroupState,
  decodeMlsMessage,
  defaultCapabilities,
  defaultKeyRetentionConfig,
  defaultLifetime,
  defaultLifetimeConfig,
  defaultKeyPackageEqualityConfig,
  defaultPaddingConfig,
  emptyPskIndex,
  encodeGroupState,
  encodeMlsMessage,
  generateKeyPackageWithKey,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroupWithExtensions,
  mlsExporter,
  processPrivateMessage,
} from 'ts-mls';
import { decryptSenderData } from 'ts-mls/privateMessage.js';

import type { MlsLeafCredential } from './MlsLeafCredential';
import type { MlsLeafSigner } from './MlsLeafSigner';
import type {
  MlsMembershipChange,
  MlsMembershipPolicy,
} from './MlsMembershipPolicy';

import { MlsIdentityCredential } from './MlsIdentityCredential';
import { MlsRejectedError } from './MlsRejectedError';
import { MlsRosterFrontier } from './MlsRosterFrontier';

const CIPHERSUITE = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519';
const PROTOCOL_VERSION = 'mls10';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let suitePromise: Promise<CiphersuiteImpl> | undefined;
const suite = (): Promise<CiphersuiteImpl> => {
  suitePromise ??= getCiphersuiteImpl(getCiphersuiteFromName(CIPHERSUITE));

  return suitePromise;
};

/**
 * The identity and device that an MLS leaf claims to be. The device is its
 * device credential (the PEM public key the node lists for the identity), so
 * a sibling device can tell the leaves of current devices from revoked ones.
 */
export interface MlsLeafOwner {
  readonly deviceCredential: string;
  readonly identityId: string;
}

export interface MlsKeyPackageBundle {
  readonly owner: MlsLeafOwner;
  readonly publicBytes: Uint8Array;
  /** Private material. Must stay on the device. */
  readonly privatePackage: PrivateKeyPackage;
  readonly publicPackage: KeyPackage;
}

export interface MlsCommitRecord {
  readonly id: string;
  readonly epoch: bigint;
  readonly bytes: Uint8Array;
}

export interface MlsCommitOutput {
  readonly epoch: bigint;
  readonly commit: Uint8Array;
  readonly welcome?: Uint8Array;
}

/** An application message and the leaf that signed it. */
export interface MlsOpenedMessage {
  readonly plaintext: Uint8Array;
  readonly sender: MlsLeafOwner;
}

export type MlsCommitOutcome =
  | { kind: 'applied'; epoch: bigint }
  | { kind: 'replaced'; epoch: bigint; discardedCommitId: string }
  | { kind: 'ignored'; reason: 'duplicate' | 'lost-race' | 'stale' }
  | { kind: 'gap'; have: bigint; got: bigint }
  | { kind: 'removed' };

/**
 * Every leaf credential must be signed by the identity it names; ts-mls asks
 * this of every key package, update path and welcome tree leaf, and of the
 * welcome's signer. Whether that identity may hold a leaf is the roster's
 * call at the revision the commit or welcome binds: see `judge` and `join`.
 */
const authService: AuthenticationService = {
  validateCredential(credential, signaturePublicKey) {
    return Promise.resolve(
      MlsIdentityCredential.verify(credential, signaturePublicKey) !==
        undefined,
    );
  },
};
const clientConfig: ClientConfig = {
  authService,
  keyPackageEqualityConfig: defaultKeyPackageEqualityConfig,
  keyRetentionConfig: {
    ...defaultKeyRetentionConfig,
    retainKeysForEpochs: 8,
  },
  lifetimeConfig: defaultLifetimeConfig,
  paddingConfig: defaultPaddingConfig,
};

/** A key package whose credential the signer's identity key vouches for. */
export const generateMlsKeyPackage = async (
  signer: MlsLeafSigner,
): Promise<MlsKeyPackageBundle> => {
  const cs = await suite();
  const signatureKeys = await cs.signature.keygen();
  const { privatePackage, publicPackage } = await generateKeyPackageWithKey(
    MlsIdentityCredential.issue(signer, signatureKeys.publicKey),
    defaultCapabilities(),
    defaultLifetime,
    [],
    signatureKeys,
    cs,
  );

  return {
    owner: signer.owner,
    privatePackage,
    publicBytes: encodeMlsMessage({
      keyPackage: publicPackage,
      version: PROTOCOL_VERSION,
      wireformat: 'mls_key_package',
    }),
    publicPackage,
  };
};

const decodeKeyPackage = (bytes: Uint8Array): KeyPackage => {
  const decoded = decodeMlsMessage(bytes, 0)?.[0];

  if (!decoded || decoded.wireformat !== 'mls_key_package') {
    throw new MlsRejectedError('Not an MLS key package');
  }

  return decoded.keyPackage;
};

/** Rebuilds a stored key package from its public bytes and private part. */
export const restoreMlsKeyPackage = (
  publicBytes: Uint8Array,
  privatePackage: PrivateKeyPackage,
): MlsKeyPackageBundle => {
  const publicPackage = decodeKeyPackage(publicBytes);

  return {
    owner: ownerOfKeyPackage(publicPackage),
    privatePackage,
    publicBytes,
    publicPackage,
  };
};

/**
 * The identity and device a published key package belongs to, only when
 * that identity signed its credential.
 */
export const mlsKeyPackageOwner = (publicBytes: Uint8Array): MlsLeafOwner =>
  ownerOfKeyPackage(decodeKeyPackage(publicBytes));

const ownerOfKeyPackage = ({ leafNode }: KeyPackage): MlsLeafOwner => {
  const owner = MlsIdentityCredential.verify(
    leafNode.credential,
    leafNode.signaturePublicKey,
  );

  if (!owner) throw new MlsRejectedError('Key package credential is forged');

  return owner;
};

/**
 * What a commit's proposals do to membership, by identity, judged against
 * the tree they apply to. Only adds, removals and updates may be in it.
 */
const membershipChange = (
  tree: ClientState['ratchetTree'],
  committerLeaf: number,
  proposals: readonly Proposal[],
): MlsMembershipChange => {
  const identityAt = (leafIndex: number): string => {
    const node = tree[leafIndex * 2];

    if (node?.nodeType !== 'leaf') throw new MlsRejectedError('Unknown leaf');

    return MlsIdentityCredential.ownerOf(node.leaf.credential).identityId;
  };
  const added: string[] = [];
  const removed: string[] = [];

  for (const proposal of proposals) {
    if (proposal.proposalType === 'add') {
      added.push(
        MlsIdentityCredential.ownerOf(
          proposal.add.keyPackage.leafNode.credential,
        ).identityId,
      );
    } else if (proposal.proposalType === 'remove') {
      removed.push(identityAt(proposal.remove.removed));
    } else if (proposal.proposalType !== 'update') {
      throw new MlsRejectedError('Unsupported proposal');
    }
  }

  return { added, committer: identityAt(committerLeaf), removed };
};

interface AppliedEpoch {
  readonly commitId: string;
  /** State before the commit; kept to switch to a competing commit. */
  readonly before: ClientState;
  /** The roster revision the group had bound before the commit. */
  readonly frontier: readonly string[];
}

/**
 * One MLS group as seen by one device. Immutable ts-mls states let the device
 * return to the state before a commit when a competing commit for the same
 * epoch has a lower id. Every commit and welcome binds the roster revision
 * its committer judged it at (`MlsRosterFrontier`); the group remembers the
 * revision of its last commit, which the next one must not step behind.
 */
export class MlsGroup {
  private constructor(
    public readonly groupId: string,
    private readonly owner: MlsLeafOwner,
    private readonly policy: MlsMembershipPolicy,
    private state: ClientState,
    private readonly applied: Map<bigint, AppliedEpoch>,
    private removed: boolean,
    private bound: readonly string[],
  ) {}

  public static async create(
    groupId: string,
    key: MlsKeyPackageBundle,
    policy: MlsMembershipPolicy,
  ): Promise<MlsGroup> {
    const state = await createGroup(
      encoder.encode(groupId),
      key.publicPackage,
      key.privatePackage,
      [],
      await suite(),
      clientConfig,
    );

    return new MlsGroup(
      groupId,
      key.owner,
      policy,
      state,
      new Map(),
      false,
      policy.frontier(),
    );
  }

  /**
   * Joins from a welcome whose tree holds only leaves the roster admits at
   * the revision the welcome binds.
   */
  public static async join(
    groupId: string,
    key: MlsKeyPackageBundle,
    welcomeBytes: Uint8Array,
    policy: MlsMembershipPolicy,
  ): Promise<MlsGroup> {
    const decoded = decodeMlsMessage(welcomeBytes, 0)?.[0];

    if (!decoded || decoded.wireformat !== 'mls_welcome') {
      throw new MlsRejectedError('Not an MLS welcome');
    }
    const [state, extensions] = await joinGroupWithExtensions(
      decoded.welcome,
      key.publicPackage,
      key.privatePackage,
      emptyPskIndex,
      await suite(),
      undefined,
      undefined,
      clientConfig,
    );

    if (decoder.decode(state.groupContext.groupId) !== groupId) {
      throw new MlsRejectedError('Welcome is for a different group');
    }
    const frontier = MlsRosterFrontier.decode(
      extensions.find(
        ({ extensionType }) =>
          extensionType === MlsRosterFrontier.EXTENSION_TYPE,
      )?.extensionData ?? new Uint8Array(),
    );

    if (!frontier) throw new MlsRejectedError('Welcome binds no revision');
    const group = new MlsGroup(
      groupId,
      key.owner,
      policy,
      state,
      new Map(),
      false,
      frontier,
    );

    if (!group.identities().every((id) => policy.admits(id, frontier))) {
      throw new MlsRejectedError('Welcome tree holds a non-member');
    }

    return group;
  }

  /** Restores a stored state and the roster revision it had bound. */
  public static restore(
    groupId: string,
    owner: MlsLeafOwner,
    policy: MlsMembershipPolicy,
    encoded: Uint8Array,
    frontier: readonly string[],
  ): MlsGroup {
    const decoded = decodeGroupState(encoded, 0)?.[0];

    if (!decoded) throw new MlsRejectedError('Corrupt MLS group state');

    return new MlsGroup(
      groupId,
      owner,
      policy,
      { ...decoded, clientConfig },
      new Map(),
      // A device removed before a restart must stay unable to send.
      decoded.groupActiveState.kind !== 'active',
      frontier,
    );
  }

  /** The roster revision the group's last commit or welcome bound. */
  public get frontier(): readonly string[] {
    return this.bound;
  }

  public get epoch(): bigint {
    return this.state.groupContext.epoch;
  }

  public get isRemoved(): boolean {
    return this.removed;
  }

  public serialize(): Uint8Array {
    return encodeGroupState(this.state);
  }

  /** Identities that currently hold at least one leaf. */
  public identities(): string[] {
    return [...new Set(this.leaves().map(({ owner }) => owner.identityId))];
  }

  public leaves(): (MlsLeafCredential & { index: number })[] {
    const leaves: (MlsLeafCredential & { index: number })[] = [];
    this.state.ratchetTree.forEach((node, treeIndex) => {
      if (
        node?.nodeType !== 'leaf' ||
        node.leaf.credential.credentialType !== 'basic'
      ) {
        return;
      }
      leaves.push({
        index: treeIndex / 2,
        owner: MlsIdentityCredential.ownerOf(node.leaf.credential),
        signaturePublicKey: node.leaf.signaturePublicKey,
      });
    });

    return leaves;
  }

  public async add(keyPackages: Uint8Array[]): Promise<MlsCommitOutput> {
    const packages = keyPackages.map(decodeKeyPackage);
    const frontier = this.policy.frontier();
    for (const keyPackage of packages) {
      const owner = ownerOfKeyPackage(keyPackage).identityId;

      if (!this.policy.admits(owner, frontier)) {
        throw new MlsRejectedError('Key package owner is not a member');
      }
    }

    return this.commit(
      packages.map((keyPackage) => ({
        add: { keyPackage },
        proposalType: 'add' as const,
      })),
    );
  }

  /** Removes all leaves of the identities; undefined when none remain. */
  public async removeIdentities(
    identityIds: string[],
  ): Promise<MlsCommitOutput | undefined> {
    const doomed = new Set(identityIds);

    return this.removeLeaves(({ identityId }) => doomed.has(identityId));
  }

  /**
   * Removes the leaves of these devices of one identity; undefined when
   * none holds a leaf.
   */
  public async removeDevices(
    identityId: string,
    deviceCredentials: string[],
  ): Promise<MlsCommitOutput | undefined> {
    const doomed = new Set(deviceCredentials);

    return this.removeLeaves(
      (owner) =>
        owner.identityId === identityId && doomed.has(owner.deviceCredential),
    );
  }

  /** Rotates this device's leaf key. */
  public async update(): Promise<MlsCommitOutput> {
    return this.commit([]);
  }

  public async encrypt(plaintext: Uint8Array): Promise<Uint8Array> {
    this.assertActive();
    const result = await createApplicationMessage(
      this.state,
      plaintext,
      await suite(),
    );
    this.state = result.newState;

    return encodeMlsMessage({
      privateMessage: result.privateMessage,
      version: PROTOCOL_VERSION,
      wireformat: 'mls_private_message',
    });
  }

  public async decrypt(bytes: Uint8Array): Promise<Uint8Array> {
    return (await this.open(bytes)).plaintext;
  }

  /**
   * Names the leaf that sent a private message (application or commit) in
   * an epoch this device still holds. Proves only that the sender held that
   * epoch's sender-data secret; signatures are checked when it is processed.
   */
  public async authenticate(bytes: Uint8Array): Promise<MlsLeafOwner> {
    return (await this.sender(bytes)).owner;
  }

  /**
   * Decrypts an application message and names its sender: the leaf whose
   * signature `processPrivateMessage` verified, in the epoch it was sent.
   */
  public async open(bytes: Uint8Array): Promise<MlsOpenedMessage> {
    const { message, owner } = await this.sender(bytes);

    if (message.contentType !== 'application') {
      throw new MlsRejectedError('Not an application message');
    }
    const result = await processPrivateMessage(
      this.state,
      message,
      emptyPskIndex,
      await suite(),
    );

    if (result.kind !== 'applicationMessage') {
      throw new MlsRejectedError('Not an application message');
    }
    this.state = result.newState;

    return { plaintext: result.message, sender: owner };
  }

  /** Commits the removal of every leaf `doomed` names; undefined if none. */
  private async removeLeaves(
    doomed: (owner: MlsLeafOwner) => boolean,
  ): Promise<MlsCommitOutput | undefined> {
    const indexes = this.leaves()
      .filter(({ owner }) => doomed(owner))
      .map(({ index }) => index);

    if (indexes.length === 0) return undefined;

    return this.commit(
      indexes.map((removed) => ({
        proposalType: 'remove' as const,
        remove: { removed },
      })),
    );
  }

  /** Sender-data secret and tree of the current or a retained past epoch. */
  private retained(
    epoch: bigint,
  ): Pick<ClientState, 'ratchetTree'> & { senderDataSecret: Uint8Array } {
    const data =
      epoch === this.state.groupContext.epoch
        ? {
            ratchetTree: this.state.ratchetTree,
            senderDataSecret: this.state.keySchedule.senderDataSecret,
          }
        : this.state.historicalReceiverData.get(epoch);

    if (!data) throw new MlsRejectedError('Message epoch is not retained');

    return data;
  }

  private async sender(
    bytes: Uint8Array,
  ): Promise<{ message: PrivateMessage; owner: MlsLeafOwner }> {
    const decoded = decodeMlsMessage(bytes, 0)?.[0];

    if (!decoded || decoded.wireformat !== 'mls_private_message') {
      throw new MlsRejectedError('Not an MLS private message');
    }
    const message = decoded.privateMessage;
    const epoch = this.retained(message.epoch);
    const senderData = await decryptSenderData(
      message,
      epoch.senderDataSecret,
      await suite(),
    ).catch(() => undefined);

    if (!senderData) {
      throw new MlsRejectedError('Message sender data does not open');
    }
    const leaf = epoch.ratchetTree[senderData.leafIndex * 2];

    if (
      leaf?.nodeType !== 'leaf' ||
      leaf.leaf.credential.credentialType !== 'basic'
    ) {
      throw new MlsRejectedError('Unknown message sender');
    }

    return {
      message,
      owner: MlsIdentityCredential.ownerOf(leaf.leaf.credential),
    };
  }

  /** Derives a purpose-bound secret from the current epoch. */
  public async exportSecret(
    label: string,
    context: Uint8Array,
    length = 32,
  ): Promise<Uint8Array> {
    this.assertActive();

    return mlsExporter(
      this.state.keySchedule.exporterSecret,
      label,
      context,
      length,
      await suite(),
    );
  }

  public async applyCommit(record: MlsCommitRecord): Promise<MlsCommitOutcome> {
    if (this.removed) return { kind: 'removed' };
    const previous = this.applied.get(record.epoch);
    const current = this.state.groupContext.epoch;

    if (record.epoch > current) {
      return { got: record.epoch, have: current, kind: 'gap' };
    }

    if (record.epoch < current) {
      if (!previous) return { kind: 'ignored', reason: 'stale' };

      if (previous.commitId === record.id) {
        return { kind: 'ignored', reason: 'duplicate' };
      }

      if (record.id > previous.commitId) {
        return { kind: 'ignored', reason: 'lost-race' };
      }

      return this.replace(record, previous);
    }

    if (previous?.commitId === record.id) {
      return { kind: 'ignored', reason: 'duplicate' };
    }

    return this.advance(record, this.state, this.bound);
  }

  private async replace(
    record: MlsCommitRecord,
    previous: AppliedEpoch,
  ): Promise<MlsCommitOutcome> {
    const outcome = await this.advance(
      record,
      previous.before,
      previous.frontier,
    );

    if (outcome.kind === 'applied') {
      for (const epoch of [...this.applied.keys()]) {
        if (epoch > record.epoch) this.applied.delete(epoch);
      }

      return {
        ...outcome,
        discardedCommitId: previous.commitId,
        kind: 'replaced',
      };
    }

    return outcome;
  }

  /**
   * Accepts a commit only when it comes from a member's leaf, every
   * proposal in it is that member's own, the roster at the revision the
   * commit binds admits every identity it adds and lets that member make
   * the change. A standalone proposal is never applied.
   */
  private judge(
    from: ClientState,
    incoming: Parameters<IncomingMessageCallback>[0],
    order: { baseline: readonly string[]; frontier: readonly string[] },
  ): IncomingMessageAction {
    if (incoming.kind !== 'commit' || incoming.senderLeafIndex === undefined) {
      return 'reject';
    }
    const committer = incoming.senderLeafIndex;

    if (
      incoming.proposals.some(
        ({ senderLeafIndex }) => senderLeafIndex !== committer,
      )
    ) {
      return 'reject';
    }

    try {
      const change = membershipChange(
        from.ratchetTree,
        committer,
        incoming.proposals.map(({ proposal }) => proposal),
      );

      return change.added.every((id) =>
        this.policy.admits(id, order.frontier),
      ) && this.policy.allows(change, order)
        ? 'accept'
        : 'reject';
    } catch {
      return 'reject';
    }
  }

  /**
   * The commit's authenticated data is the revision it binds; its sender's
   * leaf signs it, so neither the node nor another member can change it.
   */
  private async advance(
    record: MlsCommitRecord,
    from: ClientState,
    baseline: readonly string[],
  ): Promise<MlsCommitOutcome> {
    const decoded = decodeMlsMessage(record.bytes, 0)?.[0];

    if (!decoded || decoded.wireformat !== 'mls_private_message') {
      throw new MlsRejectedError('Not an MLS commit');
    }
    const { privateMessage } = decoded;
    const frontier = MlsRosterFrontier.decode(privateMessage.authenticatedData);

    if (privateMessage.epoch !== record.epoch || !frontier) {
      throw new MlsRejectedError('Commit does not match its record');
    }
    const result = await processPrivateMessage(
      from,
      privateMessage,
      emptyPskIndex,
      await suite(),
      (incoming) => this.judge(from, incoming, { baseline, frontier }),
    );

    if (result.kind !== 'newState' || result.actionTaken !== 'accept') {
      throw new MlsRejectedError('Commit rejected');
    }
    this.applied.set(record.epoch, {
      before: from,
      commitId: record.id,
      frontier: baseline,
    });
    this.state = result.newState;
    this.bound = frontier;

    if (result.newState.groupActiveState.kind !== 'active') {
      this.removed = true;

      return { kind: 'removed' };
    }

    return { epoch: result.newState.groupContext.epoch, kind: 'applied' };
  }

  private async commit(proposals: Proposal[]): Promise<MlsCommitOutput> {
    this.assertActive();
    const frontier = this.policy.frontier();

    if (
      !this.policy.allows(
        membershipChange(
          this.state.ratchetTree,
          this.state.privatePath.leafIndex,
          proposals,
        ),
        { baseline: this.bound, frontier },
      )
    ) {
      throw new MlsRejectedError('This member may not make this change');
    }
    const revision = MlsRosterFrontier.encode(frontier);
    const result = await createCommit(
      { cipherSuite: await suite(), state: this.state },
      {
        authenticatedData: revision,
        extraProposals: proposals,
        groupInfoExtensions: [
          {
            extensionData: revision,
            extensionType: MlsRosterFrontier.EXTENSION_TYPE,
          },
        ],
        ratchetTreeExtension: true,
      },
    );
    const epoch = this.state.groupContext.epoch;
    const commit = encodeMlsMessage(result.commit);
    // The caller publishes the commit and only then calls `confirm`.
    this.pending = {
      before: this.state,
      commit,
      epoch,
      frontier,
      state: result.newState,
    };

    return {
      commit,
      epoch,
      welcome: result.welcome
        ? encodeMlsMessage({
            version: PROTOCOL_VERSION,
            welcome: result.welcome,
            wireformat: 'mls_welcome',
          })
        : undefined,
    };
  }

  private pending?: {
    epoch: bigint;
    commit: Uint8Array;
    frontier: readonly string[];
    state: ClientState;
    before: ClientState;
  };

  /**
   * The encoded state the commit created by `add`, `removeIdentities` or
   * `update` leads to and the revision it binds, so both can be kept aside
   * before it is published.
   */
  public pendingState(): { frontier: readonly string[]; state: Uint8Array } {
    if (!this.pending) throw new MlsRejectedError('No pending commit');

    return {
      frontier: this.pending.frontier,
      state: encodeGroupState(this.pending.state),
    };
  }

  /**
   * Adopts the commit created by `add`, `removeIdentities` or `update` once the
   * node has accepted its record. Pass the record id the node assigned.
   */
  public confirm(commitId: string): MlsCommitOutcome {
    const pending = this.pending;

    if (!pending) throw new MlsRejectedError('No pending commit');
    this.pending = undefined;

    if (this.state.groupContext.epoch !== pending.epoch) {
      throw new MlsRejectedError(
        'Group moved on before the commit was confirmed',
      );
    }
    this.applied.set(pending.epoch, {
      before: pending.before,
      commitId,
      frontier: this.bound,
    });
    this.state = pending.state;
    this.bound = pending.frontier;

    return { epoch: this.state.groupContext.epoch, kind: 'applied' };
  }

  /** Drops a created commit, e.g. because another commit won the epoch. */
  public abandon(): void {
    this.pending = undefined;
  }

  private assertActive(): void {
    if (this.removed) throw new MlsRejectedError('This device was removed');
  }
}
