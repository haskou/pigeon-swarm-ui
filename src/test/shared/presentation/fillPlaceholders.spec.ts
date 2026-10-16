import { fillPlaceholders } from '../../../shared/presentation/fillPlaceholders';

describe(fillPlaceholders.name, () => {
  it('inserts every value literally, even replacement patterns', () => {
    expect(
      fillPlaceholders('From {current} to {node}.', {
        current: 'https://a$&b.example',
        node: "https://c$'d.example",
      }),
    ).toBe("From https://a$&b.example to https://c$'d.example.");
  });

  it('never fills placeholders that appear inside an inserted value', () => {
    expect(
      fillPlaceholders('{node} / {current}', {
        current: 'https://current.example',
        node: 'https://{current}.example',
      }),
    ).toBe('https://{current}.example / https://current.example');
  });
});
