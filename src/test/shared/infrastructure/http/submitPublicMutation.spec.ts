import type { SignedPublicMutation } from '../../../../shared/infrastructure/crypto/SignedPublicMutation';

import { HttpJsonError } from '../../../../shared/infrastructure/http/HttpJsonError';
import { submitPublicMutation } from '../../../../shared/infrastructure/http/submitPublicMutation';

describe(submitPublicMutation.name, () => {
  const stale = (sequence: number): HttpJsonError =>
    new HttpJsonError(
      409,
      'Conflict',
      JSON.stringify({
        code: 'StalePublicMutationError',
        details: { digest: 'd'.repeat(43), sequence },
      }),
    );
  const sign = jest.fn(
    (position) => ({ ...position }) as unknown as SignedPublicMutation,
  );

  beforeEach(() => sign.mockClear());

  it('re-signs as the successor of the mutation that outranked it', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(stale(4))
      .mockResolvedValueOnce(undefined);

    await submitPublicMutation({ predecessor: null, sequence: 0 }, sign, send);

    expect(sign).toHaveBeenLastCalledWith({
      predecessor: 'd'.repeat(43),
      sequence: 5,
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('does not retry other conflicts and bounds the retries', async () => {
    const other = new HttpJsonError(
      409,
      'Conflict',
      JSON.stringify({ code: 'InvalidPublicMutationError' }),
    );

    await expect(
      submitPublicMutation(
        { predecessor: null, sequence: 0 },
        sign,
        jest.fn().mockRejectedValue(other),
      ),
    ).rejects.toBe(other);
    expect(sign).toHaveBeenCalledTimes(1);

    const always = jest.fn().mockRejectedValue(stale(1));

    await expect(
      submitPublicMutation({ predecessor: null, sequence: 0 }, sign, always),
    ).rejects.toBeInstanceOf(HttpJsonError);
    expect(always).toHaveBeenCalledTimes(3);
  });
});
