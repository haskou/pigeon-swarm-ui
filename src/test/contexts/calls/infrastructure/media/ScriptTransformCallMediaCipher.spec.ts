import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { mock, type MockProxy } from 'jest-mock-extended';

import type { CallMediaKey } from '../../../../../contexts/calls/infrastructure/media/CallMediaKey';

import {
  readCallDiagnostics,
  startCallDiagnostics,
  stopCallDiagnostics,
} from '../../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { ScriptTransformCallMediaCipher } from '../../../../../contexts/calls/infrastructure/media/ScriptTransformCallMediaCipher';

const alice = { callId: 'call-1', senderId: 'identity-alice' };

function callKey(epoch = 0): CallMediaKey {
  return { epoch, key: SymmetricKey.generate().valueOf() };
}

const browserGlobals = [
  'RTCRtpReceiver',
  'RTCRtpScriptTransform',
  'RTCRtpSender',
  'Worker',
] as const;
const originalGlobals = browserGlobals.map(
  (name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const,
);

type ScriptTransformSupport = {
  ScriptTransform: jest.Mock<object, [Worker, unknown]>;
  worker: MockProxy<Worker>;
  workerConstructor: jest.Mock<Worker, [string | URL, WorkerOptions]>;
};

function defineGlobal(name: (typeof browserGlobals)[number], value: unknown) {
  Object.defineProperty(globalThis, name, { configurable: true, value });
}

/** A browser that runs encoded transforms in a worker, as Firefox does. */
function installScriptTransformSupport(): ScriptTransformSupport {
  const worker = mock<Worker>();
  const workerConstructor = jest.fn<Worker, [string | URL, WorkerOptions]>(
    () => worker,
  );
  const ScriptTransform = jest.fn<object, [Worker, unknown]>(
    (transformWorker, options) => ({ options, worker: transformWorker }),
  );
  function FakeRtpSender(): void {}
  function FakeRtpReceiver(): void {}

  for (const owner of [FakeRtpSender, FakeRtpReceiver]) {
    Object.defineProperty(owner.prototype, 'transform', {
      configurable: true,
      value: null,
      writable: true,
    });
  }
  defineGlobal('RTCRtpSender', FakeRtpSender);
  defineGlobal('RTCRtpReceiver', FakeRtpReceiver);
  defineGlobal('RTCRtpScriptTransform', ScriptTransform);
  defineGlobal('Worker', workerConstructor);

  return { ScriptTransform, worker, workerConstructor };
}

function fakeSender(): RTCRtpSender {
  return { transform: null } as unknown as RTCRtpSender;
}

function fakeReceiver(): RTCRtpReceiver {
  return { transform: null } as unknown as RTCRtpReceiver;
}

/** `owner` as the browser hands it over when it will not transform it. */
function refusingTransform<Owner extends RTCRtpReceiver | RTCRtpSender>(
  owner: Owner,
): Owner {
  return Object.defineProperty(owner, 'transform', {
    set(): void {
      throw new DOMException('Transform in use.', 'InvalidStateError');
    },
  });
}

function workerErrorListener(worker: MockProxy<Worker>): EventListener {
  const listener = worker.addEventListener.mock.calls.find(
    ([type]) => type === 'error',
  )?.[1];

  if (typeof listener !== 'function') throw new Error('No error listener.');

  return listener;
}

describe(ScriptTransformCallMediaCipher.name, () => {
  afterEach(() => {
    stopCallDiagnostics();

    for (const [name, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  });

  it('is supported where senders and receivers take an RTCRtpScriptTransform', () => {
    installScriptTransformSupport();

    expect(ScriptTransformCallMediaCipher.isSupported()).toBe(true);
  });

  it.each(['RTCRtpScriptTransform', 'Worker'] as const)(
    'is not supported without %s',
    (missing) => {
      installScriptTransformSupport();
      Reflect.deleteProperty(globalThis, missing);

      expect(ScriptTransformCallMediaCipher.isSupported()).toBe(false);
    },
  );

  it('is not supported where senders cannot take a transform', () => {
    installScriptTransformSupport();
    defineGlobal('RTCRtpSender', function LegacyRtpSender(): void {});

    expect(ScriptTransformCallMediaCipher.isSupported()).toBe(false);
  });

  it('runs its transforms in a module worker', () => {
    const { workerConstructor } = installScriptTransformSupport();

    new ScriptTransformCallMediaCipher(alice, callKey());

    expect(workerConstructor).toHaveBeenCalledTimes(1);
    expect(workerConstructor).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ type: 'module' }),
    );
  });

  it('names the call to its worker, then hands it the call key of the epoch, transferring it away', () => {
    const { worker } = installScriptTransformSupport();
    const key = SymmetricKey.generate().valueOf();

    new ScriptTransformCallMediaCipher(alice, { epoch: 4, key });

    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.postMessage).toHaveBeenNthCalledWith(1, {
      ...alice,
      type: 'call',
    });
    const [message, transfer] = worker.postMessage.mock.calls[1] as [
      { epoch: number; key: ArrayBuffer; type: string },
      Transferable[],
    ];

    expect(message.type).toBe('key');
    expect(message.epoch).toBe(4);
    expect(new Uint8Array(message.key)).toEqual(
      Uint8Array.from(Buffer.from(key, 'base64')),
    );
    expect(transfer).toHaveLength(1);
    expect(transfer[0]).toBe(message.key);
  });

  it('hands the key of each new epoch to its worker, transferring it away', () => {
    const { worker } = installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(alice, callKey());
    const nextKey = callKey(1);

    cipher.rekey(nextKey);

    const [message, transfer] = worker.postMessage.mock.calls[2] as [
      { epoch: number; key: ArrayBuffer; type: string },
      Transferable[],
    ];

    expect(message).toEqual({
      epoch: 1,
      key: expect.any(ArrayBuffer),
      type: 'key',
    });
    expect(new Uint8Array(message.key)).toEqual(
      Uint8Array.from(Buffer.from(nextKey.key, 'base64')),
    );
    expect(transfer).toEqual([message.key]);
  });

  it('tells its worker to forget a member who left', () => {
    const { worker } = installScriptTransformSupport();

    new ScriptTransformCallMediaCipher(alice, callKey()).forget('identity-bob');

    expect(worker.postMessage).toHaveBeenLastCalledWith({
      senderId: 'identity-bob',
      type: 'forget',
    });
  });

  it('encrypts each sender in its worker, without handing the key to the transform', () => {
    const { ScriptTransform, worker } = installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(alice, callKey());
    const sender = fakeSender();

    expect(cipher.configureSender(sender, 'screen-video')).toBe(true);
    expect(ScriptTransform).toHaveBeenCalledWith(worker, {
      senderId: alice.senderId,
      side: 'send',
      track: 'screen-video',
    });
    expect(sender.transform).toBe(ScriptTransform.mock.results[0].value);
  });

  it('decrypts each receiver in its worker, without handing the key to the transform', () => {
    const { ScriptTransform, worker } = installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(alice, callKey());
    const receiver = fakeReceiver();

    expect(cipher.configureReceiver(receiver, 'identity-bob', 'audio')).toBe(
      true,
    );
    expect(ScriptTransform).toHaveBeenCalledWith(worker, {
      senderId: 'identity-bob',
      side: 'receive',
      track: 'audio',
    });
    expect(receiver.transform).toBe(ScriptTransform.mock.results[0].value);
  });

  it('gives a sender moved to another track a transform for that track', () => {
    const { ScriptTransform, worker } = installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(alice, callKey());
    const sender = fakeSender();

    cipher.configureSender(sender, 'video');
    cipher.configureSender(sender, 'screen-video');

    expect(ScriptTransform).toHaveBeenLastCalledWith(worker, {
      senderId: alice.senderId,
      side: 'send',
      track: 'screen-video',
    });
    expect(sender.transform).toBe(ScriptTransform.mock.results[1].value);
  });

  it('transforms each sender and receiver once per track', () => {
    const { ScriptTransform } = installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(alice, callKey());
    const sender = fakeSender();
    const receiver = fakeReceiver();

    cipher.configureSender(sender, 'audio');
    cipher.configureSender(sender, 'audio');
    cipher.configureReceiver(receiver, 'identity-bob', 'video');
    cipher.configureReceiver(receiver, 'identity-bob', 'video');

    expect(ScriptTransform).toHaveBeenCalledTimes(2);
  });

  it('fails when the browser will not encrypt a sender', () => {
    installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(alice, callKey());

    expect(
      cipher.configureSender(refusingTransform(fakeSender()), 'audio'),
    ).toBe(false);
    expect(cipher.failed).toBe(true);
  });

  it('fails when the browser will not decrypt a receiver', () => {
    installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(alice, callKey());

    expect(
      cipher.configureReceiver(
        refusingTransform(fakeReceiver()),
        'identity-bob',
        'audio',
      ),
    ).toBe(false);
    expect(cipher.failed).toBe(true);
  });

  it('encrypts nothing once it has failed, not even what it already did', () => {
    const { ScriptTransform } = installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(alice, callKey());
    const sender = fakeSender();

    cipher.configureSender(sender, 'audio');
    cipher.configureSender(refusingTransform(fakeSender()), 'audio');

    expect(cipher.configureSender(sender, 'audio')).toBe(false);
    expect(cipher.configureSender(fakeSender(), 'audio')).toBe(false);
    expect(
      cipher.configureReceiver(fakeReceiver(), 'identity-bob', 'audio'),
    ).toBe(false);
    expect(ScriptTransform).toHaveBeenCalledTimes(2);
  });

  it('fails when its worker fails', () => {
    const { ScriptTransform, worker } = installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(alice, callKey());

    expect(cipher.failed).toBe(false);
    workerErrorListener(worker)(new Event('error'));

    expect(cipher.failed).toBe(true);
    expect(cipher.configureSender(fakeSender(), 'audio')).toBe(false);
    expect(ScriptTransform).not.toHaveBeenCalled();
  });

  it('terminates its worker when disposed', () => {
    const { worker } = installScriptTransformSupport();

    new ScriptTransformCallMediaCipher(alice, callKey()).dispose();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('keeps the peer configuration as it is', () => {
    installScriptTransformSupport();

    expect(
      new ScriptTransformCallMediaCipher(alice, callKey()).peerConfiguration({
        iceServers: [],
      }),
    ).toEqual({ iceServers: [] });
  });

  it('records a failing worker without the call key', () => {
    const { worker } = installScriptTransformSupport();
    const key = SymmetricKey.generate().valueOf();

    startCallDiagnostics();
    new ScriptTransformCallMediaCipher(alice, { epoch: 4, key });
    workerErrorListener(worker)(
      Object.assign(new Event('error'), { message: 'Script failed to load.' }),
    );

    const diagnostics = readCallDiagnostics();

    expect(diagnostics.events.map((event) => event.event)).toContain(
      'peer-manager:media-encryption:worker-failed',
    );
    expect(JSON.stringify(diagnostics)).not.toContain(key);
  });
});
