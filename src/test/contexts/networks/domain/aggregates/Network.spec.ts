import { Timestamp } from '@haskou/value-objects';

import { Network } from '../../../../../contexts/networks/domain/aggregates/Network';
import { NetworkInviteUnavailableError } from '../../../../../contexts/networks/domain/errors/NetworkInviteUnavailableError';
import { NetworkNotAttachedError } from '../../../../../contexts/networks/domain/errors/NetworkNotAttachedError';
import { NetworkCreated } from '../../../../../contexts/networks/domain/events/NetworkCreated';
import { NetworkJoined } from '../../../../../contexts/networks/domain/events/NetworkJoined';
import { NetworkRemoved } from '../../../../../contexts/networks/domain/events/NetworkRemoved';
import { NetworkId } from '../../../../../contexts/networks/domain/value-objects/NetworkId';
import { NetworkKey } from '../../../../../contexts/networks/domain/value-objects/NetworkKey';
import { NetworkName } from '../../../../../contexts/networks/domain/value-objects/NetworkName';

describe(Network.name, () => {
  it('creates an attached private network and records creation', () => {
    const network = Network.create(
      NetworkName.fromString('Builders'),
      new Timestamp(100),
    );
    const primitives = network.toPrimitives();

    expect(primitives).toMatchObject({ name: 'Builders', status: 'attached' });
    expect(primitives.id).not.toBe('');
    expect(primitives.key).not.toBe('');
    expect(network.pullDomainEvents()[0]).toBeInstanceOf(NetworkCreated);
  });

  it('joins a private network and can issue its invite', () => {
    const network = Network.join(
      NetworkId.fromString('network-a'),
      NetworkName.fromString('Builders'),
      NetworkKey.fromString('secret-key'),
      new Timestamp(100),
    );

    expect(network.issueInvite().toPrimitives()).toEqual({
      id: 'network-a',
      key: 'secret-key',
      name: 'Builders',
    });
    expect(network.pullDomainEvents()[0]).toBeInstanceOf(NetworkJoined);
  });

  it('removes an attached network once and records the transition', () => {
    const network = Network.fromPrimitives({
      id: 'network-a',
      key: 'secret-key',
      name: 'Builders',
      status: 'attached',
    });

    network.remove(new Timestamp(100));

    expect(network.toPrimitives().status).toBe('removed');
    expect(network.pullDomainEvents()[0]).toBeInstanceOf(NetworkRemoved);
    expect(() => network.remove(new Timestamp(200))).toThrow(
      NetworkNotAttachedError,
    );
  });

  it('hydrates and serializes without changing state', () => {
    const primitives = {
      id: 'network-a',
      key: 'secret-key',
      name: 'Builders',
      status: 'attached' as const,
    };

    expect(Network.fromPrimitives(primitives).toPrimitives()).toEqual(
      primitives,
    );
  });

  it('does not issue invites for public networks without a private key', () => {
    const network = Network.fromPrimitives({
      id: 'public-network',
      key: undefined,
      name: 'Public network',
      status: 'attached',
    });

    expect(() => network.issueInvite()).toThrow(
      NetworkInviteUnavailableError,
    );
  });
});
