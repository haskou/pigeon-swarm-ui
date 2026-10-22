import type { UnsignedCallSignal } from '../../../../../contexts/calls/infrastructure/signals/SealedCallSignal';

import { CallSignalSigningBytes } from '../../../../../contexts/calls/infrastructure/signals/CallSignalSigningBytes';
import vectors from '../../../../fixtures/call-signal-signing-vectors.json';

describe(CallSignalSigningBytes.name, () => {
  it('signs the RFC 8785 text of every field after the call signal prefix', () => {
    expect(
      CallSignalSigningBytes.signal(
        vectors.signal.unsigned as UnsignedCallSignal,
      ),
    ).toBe(vectors.signal.signingText);
  });

  it('is independent of the field order the signal was built in', () => {
    const reversed = Object.fromEntries(
      Object.entries(vectors.signal.unsigned).reverse(),
    ) as UnsignedCallSignal;

    expect(CallSignalSigningBytes.signal(reversed)).toBe(
      vectors.signal.signingText,
    );
  });

  it('signs the RFC 8785 text of a sealing record after the sealing record prefix', () => {
    expect(
      CallSignalSigningBytes.sealingRecord(vectors.sealingRecord.record),
    ).toBe(vectors.sealingRecord.signingText);
  });
});
