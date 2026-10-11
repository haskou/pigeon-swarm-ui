import { classifyCallMicrophoneError } from '../../../../../contexts/calls/presentation/hooks/classifyCallMicrophoneError';

type BrowserOptions = {
  getUserMedia?: boolean;
  secure?: boolean;
};

function browser({ getUserMedia = true, secure = true }: BrowserOptions = {}) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { isSecureContext: secure },
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      mediaDevices: getUserMedia ? { getUserMedia: () => undefined } : {},
    },
  });
}

// Browsers reject getUserMedia with a DOMException, which is an Error. Jest
// runs specs in their own realm, where Node's global DOMException is not an
// instance of the realm's Error, so the error is built here with the same
// name instead.
function domError(name: string): Error {
  return Object.assign(new Error('microphone request failed'), { name });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
  Reflect.deleteProperty(globalThis, 'navigator');
});

describe('classifyCallMicrophoneError', () => {
  it('reports a page that is not served over a secure context', () => {
    browser({ secure: false });

    expect(classifyCallMicrophoneError(domError('NotAllowedError'))).toBe(
      'not-secure',
    );
  });

  it('reports a browser without getUserMedia as unsupported', () => {
    browser({ getUserMedia: false });

    expect(classifyCallMicrophoneError(domError('NotAllowedError'))).toBe(
      'unsupported',
    );
  });

  it('reports a permission denial as denied', () => {
    browser();

    expect(classifyCallMicrophoneError(domError('NotAllowedError'))).toBe(
      'denied',
    );
  });

  it('reports a machine without a microphone as missing-device', () => {
    browser();

    expect(classifyCallMicrophoneError(domError('NotFoundError'))).toBe(
      'missing-device',
    );
  });

  it('reports a microphone held by another application as in-use', () => {
    browser();

    expect(classifyCallMicrophoneError(domError('NotReadableError'))).toBe(
      'in-use',
    );
  });

  it('reports unsatisfiable capture constraints as constraint', () => {
    browser();

    expect(classifyCallMicrophoneError(domError('OverconstrainedError'))).toBe(
      'constraint',
    );
  });

  it('reports a security error from the capture request as security', () => {
    browser();

    expect(classifyCallMicrophoneError(domError('SecurityError'))).toBe(
      'security',
    );
  });

  it('reports a TypeError from malformed capture options as unsupported', () => {
    browser();

    expect(classifyCallMicrophoneError(new TypeError('bad options'))).toBe(
      'unsupported',
    );
  });

  it('reports an unrecognised failure as unknown', () => {
    browser();

    expect(classifyCallMicrophoneError(domError('AbortError'))).toBe('unknown');
  });

  it('reports a rejection that is not an Error as unknown', () => {
    browser();

    expect(classifyCallMicrophoneError('nope')).toBe('unknown');
  });
});
