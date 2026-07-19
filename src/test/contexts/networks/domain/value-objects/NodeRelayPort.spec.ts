import { NullObject } from '@haskou/value-objects';

import { NodeRelayPortInvalidError } from '../../../../../contexts/networks/domain/errors/NodeRelayPortInvalidError';
import { NodeRelayPort } from '../../../../../contexts/networks/domain/value-objects/NodeRelayPort';

describe(NodeRelayPort.name, () => {
  it.each([0, 65_536, 1.5])('rejects invalid port %s', (port) => {
    expect(() => NodeRelayPort.fromNumber(port)).toThrow(
      NodeRelayPortInvalidError,
    );
  });

  it('represents an omitted optional port with a null object', () => {
    expect(NullObject.isNullObject(NodeRelayPort.fromOptional())).toBe(true);
  });
});
