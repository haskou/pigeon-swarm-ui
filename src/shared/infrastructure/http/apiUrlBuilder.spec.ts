import { ApiUrlBuilder } from './apiUrlBuilder';

describe(ApiUrlBuilder.name, () => {
  it('joins base URLs and paths without duplicate slashes', () => {
    const builder = new ApiUrlBuilder('http://localhost:8080/');

    expect(builder.build('/identities/abc')).toBe(
      'http://localhost:8080/identities/abc',
    );
  });

  it('adds a missing slash after the base URL', () => {
    const builder = new ApiUrlBuilder('http://localhost:8080');

    expect(builder.build('keychains/user-1')).toBe(
      'http://localhost:8080/keychains/user-1',
    );
  });

  it('preserves trailing slashes because signed paths must match requests', () => {
    const builder = new ApiUrlBuilder('http://localhost:8080');

    expect(builder.build('/keychains/')).toBe(
      'http://localhost:8080/keychains/',
    );
  });
});
