import { HttpJsonError } from '../../../shared/infrastructure/http/HttpJsonError';
import { copy } from '../../../shared/presentation/i18n/copy';
import { toUserErrorMessage } from '../../../shared/presentation/toUserErrorMessage';

describe(toUserErrorMessage.name, () => {
  it('translates backend domain error codes', () => {
    const error = new HttpJsonError(
      409,
      'Conflict',
      JSON.stringify({
        code: 'InvalidMessageSignatureError',
        message: 'Message signature is not valid.',
      }),
    );

    expect(toUserErrorMessage(error, 'fallback')).toBe(
      copy.errors.backend.InvalidMessageSignatureError,
    );
  });

  it('translates numeric API error codes', () => {
    const error = new HttpJsonError(
      401,
      'Unauthorized',
      JSON.stringify({
        code: 401020,
        httpStatus: 401,
        message: 'Invalid signed request.',
      }),
    );

    expect(toUserErrorMessage(error, 'fallback')).toBe(
      copy.errors.backend[401020],
    );
  });

  it('translates replicated state warmup errors', () => {
    const error = new HttpJsonError(
      503,
      'Service Unavailable',
      JSON.stringify({
        code: 503020,
        httpStatus: 503,
        message:
          'Replicated state is not ready yet. Retry after the node finishes opening and synchronizing replicated state.',
      }),
    );

    expect(toUserErrorMessage(error, 'fallback')).toBe(
      copy.errors.backend[503020],
    );
  });

  it('translates identity publication rate limit errors', () => {
    const error = new HttpJsonError(
      429,
      'Too Many Requests',
      JSON.stringify({
        code: 429040,
        httpStatus: 429,
        message: 'Identity publication rate limit exceeded.',
      }),
    );

    expect(toUserErrorMessage(error, 'fallback')).toBe(
      copy.errors.backend[429040],
    );
  });

  it('translates the banned member error', () => {
    const error = new HttpJsonError(
      409,
      'Conflict',
      JSON.stringify({
        code: 'CommunityMemberBannedError',
        message: 'Identity is banned from this community',
      }),
    );

    expect(toUserErrorMessage(error, 'fallback')).toBe(
      copy.errors.backend.CommunityMemberBannedError,
    );
  });

  it('translates the community operation limit error instead of the generic fallback', () => {
    const error = new HttpJsonError(
      409,
      'Conflict',
      JSON.stringify({
        code: 'CommunityOperationLimitExceededError',
        message: 'Community operation limit exceeded',
      }),
    );

    const message = toUserErrorMessage(error, 'fallback');

    expect(message).not.toBe('fallback');
    expect(message).toBe(
      copy.errors.backend.CommunityOperationLimitExceededError,
    );
  });

  it('falls back to readable HTTP status messages instead of raw JSON', () => {
    const error = new HttpJsonError(
      422,
      'Unprocessable Entity',
      JSON.stringify({
        code: 'UnknownBackendError',
        message: 'Noisy backend details.',
      }),
    );

    expect(toUserErrorMessage(error, 'fallback')).toBe(copy.errors.validation);
  });

  it('returns the contextual fallback for unknown server errors', () => {
    const error = new HttpJsonError(
      500,
      'Internal Server Error',
      '{"message":"stack-ish backend output"}',
    );

    expect(toUserErrorMessage(error, 'fallback')).toBe('fallback');
  });

  it('uses a network message for fetch failures', () => {
    expect(toUserErrorMessage(new TypeError('Failed to fetch'))).toBe(
      copy.errors.network,
    );
  });
});
