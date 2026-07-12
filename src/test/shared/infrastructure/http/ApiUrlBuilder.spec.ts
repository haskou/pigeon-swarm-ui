import { ApiUrlBuilder } from '../../../../shared/infrastructure/http/ApiUrlBuilder';

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

  it('extracts the API route prefix from base URLs', () => {
    expect(ApiUrlBuilder.pathPrefix('/api')).toBe('/api');
    expect(ApiUrlBuilder.pathPrefix('https://example.com/api/')).toBe('/api');
    expect(ApiUrlBuilder.pathPrefix('http://localhost:8080')).toBe('');
  });
});
