import type { MlsRecordInput } from '../../../../../contexts/communities/infrastructure/http/MlsRecordInput';

import { deriveMlsRecordId } from '../../../../../contexts/communities/infrastructure/http/deriveMlsRecordId';
import { canonicalJson } from '../../../../../shared/infrastructure/crypto/canonicalJson';
import vectors from '../../../../fixtures/mls-record-id-vectors.json';

// The fixture is the node's tests/fixtures/mls-record-id-vectors.json, checked
// there by MLSRecordId.derive and the replication policy.
describe('deriveMlsRecordId vectors', () => {
  it.each(vectors.cases)(
    'pins the canonical bytes of $name',
    ({ derived, input }) => {
      expect(canonicalJson(input)).toBe(derived.canonical);
    },
  );

  it.each([...vectors.cases, ...vectors.equivalent])(
    'derives the node record id of $name',
    ({ derived, input }) => {
      expect(deriveMlsRecordId(input as MlsRecordInput)).toBe(derived.recordId);
    },
  );

  it.each(vectors.distinct)(
    'does not derive the id of $name',
    ({ canonical, recordId }) => {
      expect(
        deriveMlsRecordId(JSON.parse(canonical) as MlsRecordInput),
      ).not.toBe(recordId);
    },
  );
});
