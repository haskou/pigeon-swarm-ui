import {
  type AuthenticationService,
  type ClientConfig,
  type ClientState,
  type CiphersuiteImpl,
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
  generateKeyPackage,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  mlsExporter,
  processPrivateMessage,
} from 'ts-mls';

import { MlsRejectedError } from './MlsRejectedError';

const CIPHERSUITE = 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519';
const PROTOCOL_VERSION = 'mls10';
const CREDENTIAL_SEPARATOR = '\u0000';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

let suitePromise: Promise<CiphersuiteImpl> | undefined;
const suite = (): Promise<CiphersuiteImpl> => {
  suitePromise ??= getCiphersuiteImpl(getCiphersuiteFromName(CIPHERSUITE));

  return suitePromise;
};

/** The identity and device that an MLS leaf claims to be. */
export interface MlsLeafOwner {
  readonly identityId: string;
  readonly deviceId: string;
}

/**
 * Decides whether an identity may hold a leaf. It must be answered from the
 * community roster, never from the MLS tree itself.
 */
export type MlsMembershipPolicy = (identityId: string) => boolean;

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

export type MlsCommitOutcome =
  | { kind: 'applied'; epoch: bigint }
  | { kind: 'replaced'; epoch: bigint; discardedCommitId: string }
  | { kind: 'ignored'; reason: 'duplicate' | 'lost-race' | 'stale' }
  | { kind: 'gap'; have: bigint; got: bigint }
  | { kind: 'removed' };

const encodeOwner = ({ deviceId, identityId }: MlsLeafOwner): Uint8Array =>
  encoder.encode(`${identityId}${CREDENTIAL_SEPARATOR}${deviceId}`);

export const decodeMlsLeafOwner = (identity: Uint8Array): MlsLeafOwner => {
  const [identityId, deviceId, ...rest] = decoder
    .decode(identity)
    .split(CREDENTIAL_SEPARATOR);

  if (!identityId || !deviceId || rest.length > 0) {
    throw new MlsRejectedError('Malformed MLS credential');
  }

  return { deviceId, identityId };
};

const clientConfig = (policy: MlsMembershipPolicy): ClientConfig => {
  const authService: AuthenticationService = {
    validateCredential(credential) {
      if (credential.credentialType !== 'basic') return Promise.resolve(false);
      try {
        const { identityId } = decodeMlsLeafOwner(credential.identity);

        return Promise.resolve(policy(identityId));
      } catch {
        return Promise.resolve(false);
      }
    },
  };

  return {
    authService,
    keyPackageEqualityConfig: defaultKeyPackageEqualityConfig,
    keyRetentionConfig: {
      ...defaultKeyRetentionConfig,
      retainKeysForEpochs: 8,
    },
    lifetimeConfig: defaultLifetimeConfig,
    paddingConfig: defaultPaddingConfig,
  };
};

export const generateMlsKeyPackage = async (
  owner: MlsLeafOwner,
): Promise<MlsKeyPackageBundle> => {
  const cs = await suite();
  const { privatePackage, publicPackage } = await generateKeyPackage(
    { credentialType: 'basic', identity: encodeOwner(owner) },
    defaultCapabilities(),
    defaultLifetime,
    [],
    cs,
  );

  return {
    owner,
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

/** The identity and device a published key package belongs to. */
export const mlsKeyPackageOwner = (publicBytes: Uint8Array): MlsLeafOwner =>
  ownerOfKeyPackage(decodeKeyPackage(publicBytes));

const ownerOfKeyPackage = (keyPackage: KeyPackage): MlsLeafOwner => {
  const credential = keyPackage.leafNode.credential;

  if (credential.credentialType !== 'basic') {
    throw new MlsRejectedError('Unsupported credential type');
  }

  return decodeMlsLeafOwner(credential.identity);
};

interface AppliedEpoch {
  readonly commitId: string;
  /** State before the commit; kept to switch to a competing commit. */
  readonly before: ClientState;
}

/**
 * One MLS group as seen by one device. Immutable ts-mls states let the device
 * return to the state before a commit when a competing commit for the same
 * epoch has a lower id.
 */
export class MlsGroup {
  private constructor(
    public readonly groupId: string,
    private readonly owner: MlsLeafOwner,
    private readonly policy: MlsMembershipPolicy,
    private state: ClientState,
    private readonly applied: Map<bigint, AppliedEpoch>,
    private removed: boolean,
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
      clientConfig(policy),
    );

    return new MlsGroup(groupId, key.owner, policy, state, new Map(), false);
  }

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
    const state = await joinGroup(
      decoded.welcome,
      key.publicPackage,
      key.privatePackage,
      emptyPskIndex,
      await suite(),
      undefined,
      undefined,
      clientConfig(policy),
    );

    if (decoder.decode(state.groupContext.groupId) !== groupId) {
      throw new MlsRejectedError('Welcome is for a different group');
    }

    return new MlsGroup(groupId, key.owner, policy, state, new Map(), false);
  }

  public static restore(
    groupId: string,
    owner: MlsLeafOwner,
    policy: MlsMembershipPolicy,
    encoded: Uint8Array,
  ): MlsGroup {
    const decoded = decodeGroupState(encoded, 0)?.[0];

    if (!decoded) throw new MlsRejectedError('Corrupt MLS group state');

    return new MlsGroup(
      groupId,
      owner,
      policy,
      { ...decoded, clientConfig: clientConfig(policy) },
      new Map(),
      false,
    );
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

  public leaves(): { index: number; owner: MlsLeafOwner }[] {
    const leaves: { index: number; owner: MlsLeafOwner }[] = [];
    this.state.ratchetTree.forEach((node, treeIndex) => {
      if (
        node?.nodeType !== 'leaf' ||
        node.leaf.credential.credentialType !== 'basic'
      ) {
        return;
      }
      leaves.push({
        index: treeIndex / 2,
        owner: decodeMlsLeafOwner(node.leaf.credential.identity),
      });
    });

    return leaves;
  }

  public async add(keyPackages: Uint8Array[]): Promise<MlsCommitOutput> {
    const packages = keyPackages.map(decodeKeyPackage);
    for (const keyPackage of packages) {
      if (!this.policy(ownerOfKeyPackage(keyPackage).identityId)) {
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
    const indexes = this.leaves()
      .filter(({ owner }) => doomed.has(owner.identityId))
      .map(({ index }) => index);

    if (indexes.length === 0) return undefined;

    return this.commit(
      indexes.map((removed) => ({
        proposalType: 'remove' as const,
        remove: { removed },
      })),
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
    const decoded = decodeMlsMessage(bytes, 0)?.[0];

    if (!decoded || decoded.wireformat !== 'mls_private_message') {
      throw new MlsRejectedError('Not an MLS private message');
    }

    if (decoded.privateMessage.contentType !== 'application') {
      throw new MlsRejectedError('Not an application message');
    }
    const result = await processPrivateMessage(
      this.state,
      decoded.privateMessage,
      emptyPskIndex,
      await suite(),
    );

    if (result.kind !== 'applicationMessage') {
      throw new MlsRejectedError('Not an application message');
    }
    this.state = result.newState;

    return result.message;
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

    return this.advance(record, this.state);
  }

  private async replace(
    record: MlsCommitRecord,
    previous: AppliedEpoch,
  ): Promise<MlsCommitOutcome> {
    const outcome = await this.advance(record, previous.before);

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

  private async advance(
    record: MlsCommitRecord,
    from: ClientState,
  ): Promise<MlsCommitOutcome> {
    const decoded = decodeMlsMessage(record.bytes, 0)?.[0];

    if (!decoded || decoded.wireformat !== 'mls_private_message') {
      throw new MlsRejectedError('Not an MLS commit');
    }

    if (decoded.privateMessage.epoch !== record.epoch) {
      throw new MlsRejectedError('Commit epoch does not match its record');
    }
    const result = await processPrivateMessage(
      from,
      decoded.privateMessage,
      emptyPskIndex,
      await suite(),
    );

    if (result.kind !== 'newState' || result.actionTaken !== 'accept') {
      throw new MlsRejectedError('Commit rejected');
    }
    this.applied.set(record.epoch, { before: from, commitId: record.id });
    this.state = result.newState;

    if (result.newState.groupActiveState.kind !== 'active') {
      this.removed = true;

      return { kind: 'removed' };
    }

    return { epoch: result.newState.groupContext.epoch, kind: 'applied' };
  }

  private async commit(proposals: Proposal[]): Promise<MlsCommitOutput> {
    this.assertActive();
    const result = await createCommit(
      { cipherSuite: await suite(), state: this.state },
      { extraProposals: proposals, ratchetTreeExtension: true },
    );
    const epoch = this.state.groupContext.epoch;
    const commit = encodeMlsMessage(result.commit);
    // The caller publishes the commit and only then calls `confirm`.
    this.pending = {
      before: this.state,
      commit,
      epoch,
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
    state: ClientState;
    before: ClientState;
  };

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
    this.applied.set(pending.epoch, { before: pending.before, commitId });
    this.state = pending.state;

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
