import { copy } from './i18n/en';
import { HttpJsonError } from '../infrastructure/http/httpJsonError';
import { toUserErrorMessage } from './toUserErrorMessage';

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
