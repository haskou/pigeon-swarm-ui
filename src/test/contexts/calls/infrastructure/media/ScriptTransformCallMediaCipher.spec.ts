import { SymmetricKey } from '@haskou/pigeon-swarm-crypto';
import { mock, type MockProxy } from 'jest-mock-extended';

import {
  readCallDiagnostics,
  startCallDiagnostics,
  stopCallDiagnostics,
} from '../../../../../contexts/calls/infrastructure/media/callDebugLogger';
import { ScriptTransformCallMediaCipher } from '../../../../../contexts/calls/infrastructure/media/ScriptTransformCallMediaCipher';

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
  return {
    replaceTrack: jest.fn(() => Promise.resolve()),
    transform: null,
  } as unknown as RTCRtpSender;
}

function fakeReceiver(): RTCRtpReceiver {
  return {
    track: { stop: jest.fn() },
    transform: null,
  } as unknown as RTCRtpReceiver;
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

    new ScriptTransformCallMediaCipher(SymmetricKey.generate().valueOf());

    expect(workerConstructor).toHaveBeenCalledTimes(1);
    expect(workerConstructor).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ type: 'module' }),
    );
  });

  it('hands the call key to its worker by message, transferring it away', () => {
    const { worker } = installScriptTransformSupport();
    const key = SymmetricKey.generate().valueOf();

    new ScriptTransformCallMediaCipher(key);

    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    const [message, transfer] = worker.postMessage.mock.calls[0] as [
      { key: ArrayBuffer },
      Transferable[],
    ];

    expect(new Uint8Array(message.key)).toEqual(
      Uint8Array.from(Buffer.from(key, 'base64')),
    );
    expect(transfer).toHaveLength(1);
    expect(transfer[0]).toBe(message.key);
  });

  it('encrypts each sender in its worker, without handing the key to the transform', () => {
    const { ScriptTransform, worker } = installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(
      SymmetricKey.generate().valueOf(),
    );
    const sender = fakeSender();

    cipher.configureSender(sender);

    expect(ScriptTransform).toHaveBeenCalledWith(worker, { side: 'send' });
    expect(sender.transform).toBe(ScriptTransform.mock.results[0].value);
  });

  it('decrypts each receiver in its worker, without handing the key to the transform', () => {
    const { ScriptTransform, worker } = installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(
      SymmetricKey.generate().valueOf(),
    );
    const receiver = fakeReceiver();

    cipher.configureReceiver(receiver);

    expect(ScriptTransform).toHaveBeenCalledWith(worker, { side: 'receive' });
    expect(receiver.transform).toBe(ScriptTransform.mock.results[0].value);
  });

  it('transforms each sender and receiver once', () => {
    const { ScriptTransform } = installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(
      SymmetricKey.generate().valueOf(),
    );
    const sender = fakeSender();
    const receiver = fakeReceiver();

    cipher.configureSender(sender);
    cipher.configureSender(sender);
    cipher.configureReceiver(receiver);
    cipher.configureReceiver(receiver);

    expect(ScriptTransform).toHaveBeenCalledTimes(2);
  });

  it('stops sending media the browser will not encrypt', () => {
    installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(
      SymmetricKey.generate().valueOf(),
    );
    const sender = fakeSender();

    Object.defineProperty(sender, 'transform', {
      set(): void {
        throw new DOMException('Transform in use.', 'InvalidStateError');
      },
    });

    expect(() => cipher.configureSender(sender)).not.toThrow();
    expect(sender.replaceTrack).toHaveBeenCalledWith(null);
  });

  it('stops playing media the browser will not decrypt', () => {
    installScriptTransformSupport();
    const cipher = new ScriptTransformCallMediaCipher(
      SymmetricKey.generate().valueOf(),
    );
    const receiver = fakeReceiver();

    Object.defineProperty(receiver, 'transform', {
      set(): void {
        throw new DOMException('Transform in use.', 'InvalidStateError');
      },
    });

    expect(() => cipher.configureReceiver(receiver)).not.toThrow();
    expect(receiver.track.stop).toHaveBeenCalled();
  });

  it('terminates its worker when disposed', () => {
    const { worker } = installScriptTransformSupport();

    new ScriptTransformCallMediaCipher(
      SymmetricKey.generate().valueOf(),
    ).dispose();

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('keeps the peer configuration as it is', () => {
    installScriptTransformSupport();

    expect(
      new ScriptTransformCallMediaCipher(
        SymmetricKey.generate().valueOf(),
      ).peerConfiguration({ iceServers: [] }),
    ).toEqual({ iceServers: [] });
  });

  it('records a failing worker without the call key', () => {
    const { worker } = installScriptTransformSupport();
    const key = SymmetricKey.generate().valueOf();

    startCallDiagnostics();
    new ScriptTransformCallMediaCipher(key);
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
