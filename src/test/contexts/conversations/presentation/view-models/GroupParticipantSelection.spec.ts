import { GroupParticipantSelection } from '../../../../../contexts/conversations/presentation/view-models/GroupParticipantSelection';

const ADA = 'MCowBQYDK2VwAyEAada';
const PEM_ADA = `-----BEGIN PUBLIC KEY-----\n${ADA}\n-----END PUBLIC KEY-----\n`;
const participants = [
  { identity: { id: ADA } },
  { identity: { id: 'MCowBQYDK2VwAyEAgrace' } },
];

describe(GroupParticipantSelection.name, () => {
  it('finds a participant already added under the id in PEM form', () => {
    expect(GroupParticipantSelection.includes(participants, PEM_ADA)).toBe(
      true,
    );
  });

  it('does not find an identity that is not a participant', () => {
    expect(
      GroupParticipantSelection.includes(participants, 'MCowBQYDK2VwAyEAlinus'),
    ).toBe(false);
  });

  it('removes a participant addressed with the id in PEM form', () => {
    expect(GroupParticipantSelection.without(participants, PEM_ADA)).toEqual([
      { identity: { id: 'MCowBQYDK2VwAyEAgrace' } },
    ]);
  });
});
