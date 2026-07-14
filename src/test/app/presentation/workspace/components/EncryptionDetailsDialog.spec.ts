import { visibleEncryptionRows } from '../../../../../app/presentation/workspace/components/visibleEncryptionRows';

describe('visibleEncryptionRows', () => {
  const rows = [
    { label: 'Scope', value: 'Community' },
    { label: 'Algorithm', technical: true, value: 'AES-256-GCM' },
    { label: 'Created', technical: true, value: 'today' },
  ];

  it('hides technical encryption metadata by default', () => {
    expect(visibleEncryptionRows(rows, false)).toEqual([
      { label: 'Scope', value: 'Community' },
    ]);
  });

  it('includes all encryption metadata after explicit opt-in', () => {
    expect(visibleEncryptionRows(rows, true)).toEqual(rows);
  });
});
