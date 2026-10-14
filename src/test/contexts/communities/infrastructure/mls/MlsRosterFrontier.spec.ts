import { MlsRosterFrontier } from '../../../../../contexts/communities/infrastructure/mls/MlsRosterFrontier';

const digest = (letter: string): string => letter.repeat(43);
const text = (value: string): Uint8Array => new TextEncoder().encode(value);

describe('MlsRosterFrontier', () => {
  it('round-trips a frontier in sorted order', () => {
    const encoded = MlsRosterFrontier.encode([digest('b'), digest('a')]);

    expect(MlsRosterFrontier.decode(encoded)).toEqual([
      digest('a'),
      digest('b'),
    ]);
  });

  it('reads empty bytes as a frontier that binds nothing', () => {
    expect(MlsRosterFrontier.decode(new Uint8Array())).toEqual([]);
  });

  it.each([
    ['another prefix', text(`other:v1\n${digest('a')}`)],
    ['a malformed digest', text(`pigeon:community-frontier:v1\nshort`)],
    ['invalid UTF-8', new Uint8Array([0xff, 0xfe])],
    [
      'too many heads',
      MlsRosterFrontier.encode(Array.from({ length: 257 }, () => digest('a'))),
    ],
  ])('refuses %s', (_name, bytes) => {
    expect(MlsRosterFrontier.decode(bytes)).toBeUndefined();
  });
});
