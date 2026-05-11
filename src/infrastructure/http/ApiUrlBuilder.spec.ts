import { ApiUrlBuilder } from './ApiUrlBuilder';

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
});
