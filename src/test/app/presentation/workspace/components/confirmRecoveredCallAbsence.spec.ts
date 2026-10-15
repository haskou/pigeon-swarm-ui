import type { CallResource } from '../../../../../contexts/calls/infrastructure/http/resources/CallResource';

import { confirmRecoveredCallAbsence } from '../../../../../app/presentation/workspace/components/confirmRecoveredCallAbsence';
import { HttpJsonError } from '../../../../../shared/infrastructure/http/HttpJsonError';

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
}

function callWith(
  status: string,
  participantStatus: string,
  identityId = 'me',
): CallResource {
  return {
    id: 'call-1',
    participants: [{ identityId, status: participantStatus }],
    status,
  } as unknown as CallResource;
}

const nodeNotReady = new HttpJsonError(
  503,
  'Service Unavailable',
  JSON.stringify({ code: 503020 }),
);
const callNotFound = new HttpJsonError(
  409,
  'Conflict',
  JSON.stringify({ code: 'CallNotFoundError' }),
);

function start(
  getCall: jest.Mock,
  mediaAlive: () => boolean = () => true,
) {
  const onEnded = jest.fn();
  const onConfirmed = jest.fn();
  const cancel = confirmRecoveredCallAbsence({
    callId: 'call-1',
    currentIdentityId: 'me',
    getCall,
    isMediaAlive: mediaAlive,
    onConfirmed,
    onEnded,
  });

  return { cancel, onConfirmed, onEnded };
}

describe(confirmRecoveredCallAbsence.name, () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps the call and retries while the node answers 503 not ready', async () => {
    const getCall = jest
      .fn()
      .mockRejectedValueOnce(nodeNotReady)
      .mockResolvedValueOnce(callWith('active', 'joined'));
    const { onConfirmed, onEnded } = start(getCall);

    await flushPromises();
    expect(onEnded).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    await flushPromises();
    expect(getCall).toHaveBeenCalledTimes(2);
    expect(onConfirmed).toHaveBeenCalledWith(callWith('active', 'joined'));
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('keeps the call and retries on other transient errors', async () => {
    const getCall = jest
      .fn()
      .mockRejectedValueOnce(new TypeError('network down'))
      .mockRejectedValueOnce(new HttpJsonError(502, 'Bad Gateway', ''))
      .mockResolvedValueOnce(callWith('active', 'joined'));
    const { onEnded } = start(getCall);

    await flushPromises();
    jest.advanceTimersByTime(1000);
    await flushPromises();
    jest.advanceTimersByTime(2000);
    await flushPromises();
    expect(getCall).toHaveBeenCalledTimes(3);
    expect(onEnded).not.toHaveBeenCalled();
  });

  it('ends the call on 409 CallNotFoundError', async () => {
    const { onEnded } = start(jest.fn().mockRejectedValue(callNotFound));

    await flushPromises();
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('ends the call when the resource is ended', async () => {
    const { onEnded } = start(
      jest.fn().mockResolvedValue(callWith('ended', 'joined')),
    );

    await flushPromises();
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('ends the call when the current identity is no longer joined', async () => {
    const { onEnded } = start(
      jest.fn().mockResolvedValue(callWith('active', 'left')),
    );

    await flushPromises();
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('ends a call with dead media once confirmation stays pending past the bound', async () => {
    const getCall = jest.fn().mockRejectedValue(nodeNotReady);
    const { onEnded } = start(getCall, () => false);

    await flushPromises();
    jest.advanceTimersByTime(29_000);
    await flushPromises();
    expect(onEnded).not.toHaveBeenCalled();

    for (let step = 0; step < 6; step += 1) {
      jest.advanceTimersByTime(8000);
      await flushPromises();
    }
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it('keeps a call with live media past the bound', async () => {
    const getCall = jest.fn().mockRejectedValue(nodeNotReady);
    const { cancel, onEnded } = start(getCall, () => true);

    for (let step = 0; step < 20; step += 1) {
      jest.advanceTimersByTime(8000);
      await flushPromises();
    }
    expect(onEnded).not.toHaveBeenCalled();
    cancel();
  });

  it('stops checking when cancelled', async () => {
    const getCall = jest.fn().mockRejectedValue(nodeNotReady);
    const { cancel } = start(getCall);

    await flushPromises();
    cancel();
    jest.advanceTimersByTime(60_000);
    await flushPromises();
    expect(getCall).toHaveBeenCalledTimes(1);
  });
});
