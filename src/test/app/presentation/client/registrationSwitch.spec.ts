import { registrationSwitchFor } from '../../../../app/presentation/client/registrationSwitch';

const link = {
  code: 'c'.repeat(43),
  node: 'https://other.example',
};

describe(registrationSwitchFor.name, () => {
  it('asks before adopting the node of a link when no node is chosen yet', () => {
    expect(registrationSwitchFor(link, false, undefined)).toEqual({
      current: null,
      node: 'https://other.example',
    });
  });

  it('asks before leaving the chosen node for the node of a link', () => {
    expect(
      registrationSwitchFor(link, false, { url: 'https://current.example' }),
    ).toEqual({
      current: 'https://current.example',
      node: 'https://other.example',
    });
  });

  it('does not ask when the link is for the chosen node', () => {
    expect(
      registrationSwitchFor(link, false, { url: 'https://other.example' }),
    ).toBeNull();
  });

  it('does not ask while the user is choosing a node', () => {
    expect(registrationSwitchFor(link, true, undefined)).toBeNull();
  });

  it('does not ask without a registration link', () => {
    expect(registrationSwitchFor(null, false, undefined)).toBeNull();
  });
});
