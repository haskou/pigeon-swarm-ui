import { CommunityRosterHistory } from '../../../../contexts/communities/domain/CommunityRosterHistory';
import { CommunityOperationHistory } from '../infrastructure/http/CommunityOperationHistory';
import { MlsTestIdentity } from '../infrastructure/mls/MlsTestIdentity';

describe('CommunityRosterHistory', () => {
  let cast: Record<string, MlsTestIdentity>;
  let signed: CommunityOperationHistory;
  /** The frontier right after carol was made a manager. */
  let promoted: string[];
  /** The frontier right after carol was demoted again. */
  let demoted: string[];
  const headOf = (history: CommunityOperationHistory): string[] => [
    CommunityOperationHistory.digestOf(
      history.documents[history.documents.length - 1],
    ),
  ];

  beforeAll(async () => {
    cast = await MlsTestIdentity.cast(['owner', 'carol']);
    const { carol, owner } = cast;

    signed = new CommunityOperationHistory(owner);
    const managers = signed.createRole(owner, ['manage_members']);

    signed.add(owner, carol);
    signed.assign(owner, carol, [managers]);
    promoted = headOf(signed);
    signed.assign(owner, carol, []);
    demoted = headOf(signed);
  });

  it('names the newest operation as the frontier of a linear history', () => {
    const history = CommunityRosterHistory.of(signed.operations());

    expect(history.heads()).toEqual(demoted);
    expect(history.latest().manages(cast.carol.id)).toBe(false);
  });

  it('replays the roster as it stood at an earlier frontier', () => {
    const history = CommunityRosterHistory.of(signed.operations());

    expect(history.rosterAt(promoted)?.manages(cast.carol.id)).toBe(true);
    expect(history.rosterAt(demoted)?.manages(cast.carol.id)).toBe(false);
  });

  it('has no roster for a frontier naming an unknown operation', () => {
    const history = CommunityRosterHistory.of(signed.operations());

    expect(history.rosterAt(['x'.repeat(43)])).toBeUndefined();
    expect(history.follows(['x'.repeat(43)], [])).toBe(false);
  });

  it('leaves out heads whose ancestry is withheld', () => {
    const operations = signed.operations();
    const withheld = CommunityRosterHistory.of(
      operations.filter((operation) => operation !== operations[1]),
    );

    expect(withheld.heads()).toEqual([
      CommunityOperationHistory.digestOf(signed.documents[0]),
    ]);
  });
  it('follows a baseline only from a frontier that descends from it', () => {
    const history = CommunityRosterHistory.of(signed.operations());

    expect(history.follows(demoted, promoted)).toBe(true);
    expect(history.follows(promoted, promoted)).toBe(true);
    expect(history.follows(promoted, demoted)).toBe(false);
  });

  it('reaches every operation a frontier stands for, none while unknown', () => {
    const history = CommunityRosterHistory.of(signed.operations());

    expect(history.reach(demoted)).toBe(signed.operations().length);
    expect(history.reach(promoted)).toBe(signed.operations().length - 1);
    expect(history.reach(['x'.repeat(43)])).toBe(0);
  });
});
