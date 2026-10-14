import { SHA256Hash } from '@haskou/pigeon-swarm-crypto';
import { StringValueObject } from '@haskou/value-objects';

import type { DeviceAuthorizationTransitionLogPrimitives } from '../../../../../contexts/identities/domain/DeviceAuthorizationTransitionLogPrimitives';

import { DeviceAuthorization } from '../../../../../contexts/identities/domain/DeviceAuthorization';
import { DeviceAuthorizationTransitionLog } from '../../../../../contexts/identities/domain/DeviceAuthorizationTransitionLog';
import { DeviceRemovedError } from '../../../../../contexts/identities/domain/DeviceRemovedError';
import { UnprovenDeviceAuthorizationError } from '../../../../../contexts/identities/domain/errors/UnprovenDeviceAuthorizationError';
import { DeviceAuthorizationPolicy } from '../../../../../contexts/identities/domain/services/DeviceAuthorizationPolicy';
import { DeviceRemovalDomainService } from '../../../../../contexts/identities/domain/services/DeviceRemovalDomainService';
import { DeviceAuthorizationEpoch } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationEpoch';
import { DeviceAuthorizationRevision } from '../../../../../contexts/identities/domain/value-objects/DeviceAuthorizationRevision';
import { DeviceCredential } from '../../../../../contexts/identities/domain/value-objects/DeviceCredential';
import { IdentityId } from '../../../../../contexts/identities/domain/value-objects/IdentityId';
import { RecoveryAuthority } from '../../../../../contexts/identities/domain/value-objects/RecoveryAuthority';
import vectors from '../../../../fixtures/device-authorization-transition-log-vectors.json';

type LogVectors = {
  identityId: string;
  keys: Record<string, { privateKeyPem: string; publicKeyPem: string }>;
  logs: {
    head: { credentials: string[]; epoch: string; revision: number };
    name: string;
    reads: {
      after: number;
      expected: DeviceAuthorizationTransitionLogPrimitives;
      name: string;
    }[];
    stored: DeviceAuthorizationTransitionLogPrimitives;
    verdicts: {
      local: { epoch: string; revision: number };
      name: string;
      reader: string;
      removedBy: null | string;
      served: DeviceAuthorizationTransitionLogPrimitives;
    }[];
  }[];
};

// The JSON module widens literal fields; the entries are the node primitives.
const fixture: LogVectors = vectors as LogVectors;
const credentialOf = (name: string): DeviceCredential =>
  DeviceCredential.fromString(fixture.keys[name].publicKeyPem);
const genesisOf = (identityId: string): DeviceAuthorization =>
  DeviceAuthorization.genesis(
    IdentityId.fromString(identityId),
    credentialOf('author'),
    RecoveryAuthority.fromString(fixture.keys.recoveryAuthority.publicKeyPem),
  );
const genesis = genesisOf(fixture.identityId);
const logOf = (
  served: DeviceAuthorizationTransitionLogPrimitives,
): DeviceAuthorizationTransitionLog =>
  DeviceAuthorizationTransitionLog.fromPrimitives(served);
const localOf = (
  local: LogVectors['logs'][number]['verdicts'][number]['local'],
) => ({
  epoch: DeviceAuthorizationEpoch.fromString(local.epoch),
  revision: DeviceAuthorizationRevision.fromNumber(local.revision),
});
const verdictOf = ({
  local,
  reader,
  served,
}: LogVectors['logs'][number]['verdicts'][number]): null | string => {
  try {
    DeviceRemovalDomainService.verify({
      genesis,
      local: localOf(local),
      log: logOf(served),
      reader: credentialOf(reader),
    });
  } catch (error) {
    if (error instanceof DeviceRemovedError) return error.operationId;
  }

  return null;
};
const served = (
  log: LogVectors['logs'][number],
  name: string,
): DeviceAuthorizationTransitionLogPrimitives => {
  const entry = log.verdicts.find((candidate) => candidate.name === name);

  if (!entry) throw new Error(`Missing vector ${name}`);

  return structuredClone(entry.served);
};
const [retirement, recovery, lostRecoveries] = fixture.logs;
const retired = served(retirement, 'the retired device proves its removal');
const [enrollment, removal] = retired.transitions;

describe(DeviceRemovalDomainService.name, () => {
  describe('shared transition log vectors', () => {
    it.each(fixture.logs.map((log) => [log.name, log] as const))(
      'replays the stored log of %s to its head',
      (_, log) => {
        const stored = logOf(log.stored);
        const replay = DeviceAuthorizationPolicy.replay(
          DeviceAuthorizationPolicy.replayRecoveryLineage(
            genesis,
            stored.getRecoveries(),
            stored.getConcurrentRecoveries(),
          ),
          stored.getCandidates(),
        );
        const head = replay.states[replay.states.length - 1];

        expect(replay.accepted).toHaveLength(stored.getCandidates().length);
        expect(
          head
            .getEpoch()
            .isEqual(DeviceAuthorizationEpoch.fromString(log.head.epoch)),
        ).toBe(true);
        expect(
          head
            .getRevision()
            .isEqual(DeviceAuthorizationRevision.fromNumber(log.head.revision)),
        ).toBe(true);

        for (const name of Object.keys(fixture.keys)) {
          const credential = credentialOf(name);

          expect(head.isAuthorized(credential)).toBe(
            log.head.credentials.some((entry) =>
              DeviceCredential.fromString(entry).isEqual(credential),
            ),
          );
        }
      },
    );

    it.each(
      fixture.logs.flatMap((log) =>
        log.reads
          .filter((read) => read.after === 0)
          .map((read) => [read.name, read] as const),
      ),
    )('verifies every transition %s', (_, read) => {
      const log = logOf(read.expected);
      const replay = DeviceAuthorizationPolicy.replay(
        DeviceAuthorizationPolicy.replayRecoveryLineage(
          genesis,
          log.getRecoveries(),
          log.getConcurrentRecoveries(),
        ),
        log.getCandidates(),
      );

      expect(replay.accepted).toHaveLength(log.getCandidates().length);
    });

    it.each(
      fixture.logs.flatMap((log) =>
        log.verdicts.map((entry) => [entry.name, entry] as const),
      ),
    )('%s', (_, entry) => {
      expect(verdictOf(entry)).toBe(entry.removedBy);
    });

    it('proves a removal behind lost recoveries served newest first', () => {
      const name =
        'a pre-recovery device proves the winning recovery removed it';
      const newestFirst = served(lostRecoveries, name);

      newestFirst.concurrentRecoveries.reverse();

      expect(
        verdictOf({
          local: { epoch: 'genesis', revision: 3 },
          name,
          reader: 'author',
          removedBy: null,
          served: newestFirst,
        }),
      ).toBe(newestFirst.recoveries[0].operationId);
    });
  });

  it('returns the verified head while it still authorizes the reader', () => {
    const head = DeviceRemovalDomainService.verify({
      genesis,
      local: localOf({ epoch: 'genesis', revision: 3 }),
      log: logOf(
        served(retirement, 'a device authorized at the head is not removed'),
      ),
      reader: credentialOf('laptop'),
    });

    expect(
      head.getRevision().isEqual(DeviceAuthorizationRevision.fromNumber(3)),
    ).toBe(true);
  });

  describe('a removal the log does not prove', () => {
    const unproven =
      (
        log: DeviceAuthorizationTransitionLogPrimitives,
        local: LogVectors['logs'][number]['verdicts'][number]['local'] = {
          epoch: 'genesis',
          revision: 1,
        },
        base: DeviceAuthorization = genesis,
      ) =>
      () =>
        DeviceRemovalDomainService.verify({
          genesis: base,
          local: localOf(local),
          log: logOf(log),
          reader: credentialOf('target'),
        });

    it('rejects a removal carrying another transition signature', () => {
      const forged = {
        ...retired,
        transitions: [
          enrollment,
          { ...removal, signature: enrollment.signature },
        ],
      };

      expect(unproven(forged)).toThrow(UnprovenDeviceAuthorizationError);
    });

    it('rejects a removal retargeted after signing', () => {
      const retarget = fixture.keys.laptop.publicKeyPem;
      const forged = {
        ...retired,
        transitions: [
          enrollment,
          {
            ...removal,
            targetCredential: retarget,
            targetCredentialCommitment: SHA256Hash.from(
              new StringValueObject(retarget),
            ).valueOf(),
          },
        ],
      };

      expect(unproven(forged)).toThrow(UnprovenDeviceAuthorizationError);
    });

    it('rejects an unsigned removal', () => {
      const unsignedRemoval = { ...removal };

      Reflect.deleteProperty(unsignedRemoval, 'signature');
      // A node serves JSON: nothing types the body before it is parsed.
      const unsigned: DeviceAuthorizationTransitionLogPrimitives = JSON.parse(
        JSON.stringify({
          ...retired,
          transitions: [enrollment, unsignedRemoval],
        }),
      );

      expect(unproven(unsigned)).toThrow();
      expect(unproven(unsigned)).not.toThrow(DeviceRemovedError);
    });

    it('rejects a removal at the revision this device already verified', () => {
      expect(unproven(retired, { epoch: 'genesis', revision: 2 })).toThrow(
        UnprovenDeviceAuthorizationError,
      );
    });

    it('rejects a log served for another identity', () => {
      expect(
        unproven(
          retired,
          undefined,
          genesisOf(
            IdentityId.fromString(fixture.keys.laptop.publicKeyPem).valueOf(),
          ),
        ),
      ).toThrow(UnprovenDeviceAuthorizationError);
    });

    it('rejects a removal replayed from another recovery authority', () => {
      expect(
        unproven(
          retired,
          undefined,
          DeviceAuthorization.genesis(
            IdentityId.fromString(fixture.identityId),
            credentialOf('laptop'),
            RecoveryAuthority.fromString(fixture.keys.target.publicKeyPem),
          ),
        ),
      ).toThrow(UnprovenDeviceAuthorizationError);
    });

    it('rejects a recovery the recovery authority did not sign', () => {
      const genuine = served(
        recovery,
        'a pre-recovery device proves the recovery removed it',
      );
      const [signed] = recovery.stored.transitions;
      const forged = {
        ...genuine,
        recoveries: genuine.recoveries.map((entry) => ({
          ...entry,
          signature: signed.signature,
        })),
      };

      expect(() =>
        DeviceRemovalDomainService.verify({
          genesis,
          local: localOf({ epoch: 'genesis', revision: 3 }),
          log: logOf(forged),
          reader: credentialOf('author'),
        }),
      ).toThrow(UnprovenDeviceAuthorizationError);
    });

    it('rejects a log whose transitions do not all replay', () => {
      const partial = { ...retired, transitions: [removal] };

      expect(unproven(partial)).toThrow(UnprovenDeviceAuthorizationError);
    });
  });
});
