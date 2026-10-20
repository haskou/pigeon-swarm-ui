import {
  CommitmentId,
  KeyPair,
  X25519KeyPair,
} from '@haskou/pigeon-swarm-crypto';

import type { DeviceAuthorizationTransitionLogPrimitives } from '../../../../../contexts/identities/domain/DeviceAuthorizationTransitionLogPrimitives';
import type { Session } from '../../../../../contexts/identities/infrastructure/session/Session';

import { CallSignalRefusedError } from '../../../../../contexts/calls/infrastructure/signals/CallSignalRefusedError';
import { CallSignalSigningBytes } from '../../../../../contexts/calls/infrastructure/signals/CallSignalSigningBytes';
import { CallSignalVerifier } from '../../../../../contexts/calls/infrastructure/signals/CallSignalVerifier';
import { DeviceAuthorization } from '../../../../../contexts/identities/domain/DeviceAuthorization';
import { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { RecoveryAuthority } from '../../../../../contexts/identities/domain/value-objects/RecoveryAuthority';
import vectors from '../../../../fixtures/device-authorization-transition-log-vectors.json';
import type { SealedCallSignal } from '../../../../../contexts/calls/infrastructure/signals/SealedCallSignal';

type Keys = Record<string, { privateKeyPem: string; publicKeyPem: string }>;

const keys: Keys = vectors.keys;
const log = vectors.logs[0]
  .stored as DeviceAuthorizationTransitionLogPrimitives;
const sender = vectors.identityId;
const recipient = 'recipient-identity';
const networkId = 'network-a';
const NOW = 1_770_000_005_000;
const pairOf = (name: string): KeyPair =>
  KeyPair.fromPrimitives({
    privateKey: keys[name].privateKeyPem,
    publicKey: keys[name].publicKeyPem,
  });
const mine = pairOf('recovered');
const mySealing = X25519KeyPair.generate();
const session = {
  deviceCredentialKeyPair: mine,
  identity: { id: recipient },
} as unknown as Session;
const genesis = (): DeviceAuthorization =>
  DeviceAuthorization.genesis(
    IdentityId.fromString(sender),
    DeviceCredential.fromString(keys.author.publicKeyPem),
    RecoveryAuthority.fromString(keys.recoveryAuthority.publicKeyPem),
  );

type Overrides = Partial<SealedCallSignal> & { signer?: string };

const signalOf = (overrides: Overrides = {}): SealedCallSignal => {
  const { signer = 'laptop', ...rest } = overrides;
  const unsigned = {
    callId: 'call-a',
    createdAt: NOW - 1_000,
    expiresAt: NOW - 1_000 + 20_000,
    networkId,
    recipientIdentityId: recipient,
    scopeType: 'conversation' as const,
    sealedEntries: [
      {
        envelope: mySealing
          .getPublicKey()
          .encrypt(JSON.stringify({ sdp: 'offer-sdp' }))
          .valueOf(),
        recipientDeviceCredential: keys.recovered.publicKeyPem,
      },
    ],
    senderDeviceCredential: keys[signer].publicKeyPem,
    senderIdentityId: sender,
    signalId: 'signal-1',
    signalType: 'offer' as const,
    ...rest,
  };

  return {
    ...unsigned,
    signature: pairOf(signer)
      .sign(CallSignalSigningBytes.signal(unsigned))
      .valueOf(),
  };
};

const build = (
  overrides: {
    clock?: () => number;
    floor?: number;
    logs?: DeviceAuthorizationTransitionLogPrimitives[];
    viewRevision?: number;
    conversationId?: string | undefined;
  } = {},
) => {
  const floors = {
    get: jest.fn().mockResolvedValue(overrides.floor ?? 0),
    raise: jest.fn().mockResolvedValue(undefined),
  };
  const verifier = new CallSignalVerifier({
    clock: overrides.clock ?? (() => NOW),
    floors,
    genesis: async () => genesis(),
    keys: { keyPair: async () => mySealing },
    logs: async () => overrides.logs ?? [log, log],
    parties: {
      conversationId: async () =>
        'conversationId' in overrides
          ? overrides.conversationId
          : CommitmentId.oneToOneConversation(sender, recipient, networkId),
    },
    view: {
      sealingView: async () => ({
        devices: [],
        identityId: sender,
        revision: overrides.viewRevision ?? 3,
      }),
    },
  });

  return { floors, verifier };
};
const refusal = async (promise: Promise<unknown>): Promise<string> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CallSignalRefusedError) return error.reason;
    throw error;
  }

  return 'accepted';
};

describe(CallSignalVerifier.name, () => {
  it('opens a signal from an authorised device and raises the floor to the verified head', async () => {
    const { floors, verifier } = build();

    await expect(verifier.receive(session, signalOf())).resolves.toEqual({
      payload: { sdp: 'offer-sdp' },
    });
    expect(floors.raise).toHaveBeenCalledWith(session, sender, 3);
  });

  it('refuses a device the verified chain revoked', async () => {
    expect(
      await refusal(
        build().verifier.receive(session, signalOf({ signer: 'target' })),
      ),
    ).toBe('sender-unauthorised');
  });

  it('refuses a device the chain never authorised', async () => {
    expect(
      await refusal(
        build().verifier.receive(session, signalOf({ signer: 'recovered' })),
      ),
    ).toBe('sender-unauthorised');
  });

  it('refuses when fewer than two replicas return a chain', async () => {
    expect(
      await refusal(
        build({ logs: [log] }).verifier.receive(session, signalOf()),
      ),
    ).toBe('chain-unverified');
  });

  it('refuses when replicas prove different states at the same revision', async () => {
    const recovered = vectors.logs[1]
      .stored as DeviceAuthorizationTransitionLogPrimitives;
    const lost = vectors.logs[2]
      .stored as DeviceAuthorizationTransitionLogPrimitives;

    expect(
      await refusal(
        build({ logs: [recovered, lost] }).verifier.receive(
          session,
          signalOf(),
        ),
      ),
    ).toBe('chain-unverified');
  });

  it('refuses a head below the persisted floor', async () => {
    expect(
      await refusal(build({ floor: 4 }).verifier.receive(session, signalOf())),
    ).toBe('stale-head');
  });

  it('refuses a sealing view that claims a revision beyond the verified head', async () => {
    expect(
      await refusal(
        build({ viewRevision: 9 }).verifier.receive(session, signalOf()),
      ),
    ).toBe('stale-head');
  });

  it('refuses a signal with a tampered signature', async () => {
    const signal = signalOf();

    expect(
      await refusal(
        build().verifier.receive(session, { ...signal, signalType: 'answer' }),
      ),
    ).toBe('bad-signature');
  });

  it('refuses a signal sent by a different identity than the conversation parties', async () => {
    expect(
      await refusal(
        build({ conversationId: 'one-to-one:other' }).verifier.receive(
          session,
          signalOf(),
        ),
      ),
    ).toBe('party-mismatch');
  });

  it('refuses a signal for a call whose scope is unknown', async () => {
    expect(
      await refusal(
        build({ conversationId: undefined }).verifier.receive(
          session,
          signalOf(),
        ),
      ),
    ).toBe('party-mismatch');
  });

  it.each(['community_channel', 'group_capability'] as const)(
    'refuses the %s scope, which this client cannot fold',
    async (scopeType) => {
      expect(
        await refusal(
          build().verifier.receive(
            session,
            signalOf({ scopeType } as unknown as Overrides),
          ),
        ),
      ).toBe('scope-unsupported');
    },
  );

  it('refuses a signal to oneself', async () => {
    expect(
      await refusal(
        build().verifier.receive(
          session,
          signalOf({ senderIdentityId: recipient }),
        ),
      ),
    ).toBe('party-mismatch');
  });

  it('refuses a signal addressed to another identity', async () => {
    expect(
      await refusal(
        build().verifier.receive(
          session,
          signalOf({ recipientIdentityId: 'someone-else' }),
        ),
      ),
    ).toBe('not-for-this-device');
  });

  it('refuses a signal with no entry for this device', async () => {
    expect(
      await refusal(
        build().verifier.receive(
          session,
          signalOf({
            sealedEntries: [
              { envelope: 'x', recipientDeviceCredential: 'another-device' },
            ],
          }),
        ),
      ),
    ).toBe('not-for-this-device');
  });

  it('refuses a lifetime that is not exactly 20 seconds', async () => {
    expect(
      await refusal(
        build().verifier.receive(
          session,
          signalOf({ expiresAt: NOW - 1_000 + 60_000 }),
        ),
      ),
    ).toBe('malformed');
  });

  it('refuses an expired signal', async () => {
    expect(
      await refusal(
        build({ clock: () => NOW + 30_000 }).verifier.receive(
          session,
          signalOf(),
        ),
      ),
    ).toBe('expired');
  });

  it('refuses a signal created more than 5 seconds in the future', async () => {
    expect(
      await refusal(
        build({ clock: () => NOW - 7_000 }).verifier.receive(
          session,
          signalOf(),
        ),
      ),
    ).toBe('expired');
  });

  it('refuses a replay of an accepted signal id', async () => {
    const { verifier } = build();

    await verifier.receive(session, signalOf());

    expect(await refusal(verifier.receive(session, signalOf()))).toBe(
      'replayed',
    );
  });

  it('refuses an envelope this device cannot decrypt', async () => {
    const other = X25519KeyPair.generate();

    expect(
      await refusal(
        build().verifier.receive(
          session,
          signalOf({
            sealedEntries: [
              {
                envelope: other.getPublicKey().encrypt('{}').valueOf(),
                recipientDeviceCredential: keys.recovered.publicKeyPem,
              },
            ],
          }),
        ),
      ),
    ).toBe('undecryptable');
  });
});
