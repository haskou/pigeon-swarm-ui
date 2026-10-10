import { watchNetworkChanges } from '../../../../../contexts/calls/infrastructure/media/networkChanges';

describe('watchNetworkChanges', () => {
  it('reports when connectivity is regained', () => {
    const events = new EventTarget();
    const onChange = jest.fn();

    watchNetworkChanges(onChange, { events });
    events.dispatchEvent(new Event('online'));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reports when the network connection changes, such as Wi-Fi to cellular', () => {
    const events = new EventTarget();
    const connection = new EventTarget();
    const onChange = jest.fn();

    watchNetworkChanges(onChange, { connection, events });
    connection.dispatchEvent(new Event('change'));

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('ignores network events when the browser exposes no connection object', () => {
    const events = new EventTarget();
    const onChange = jest.fn();

    watchNetworkChanges(onChange, { events });
    events.dispatchEvent(new Event('change'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops reporting once the cleanup has run', () => {
    const events = new EventTarget();
    const connection = new EventTarget();
    const onChange = jest.fn();

    const stop = watchNetworkChanges(onChange, { connection, events });
    stop();
    events.dispatchEvent(new Event('online'));
    connection.dispatchEvent(new Event('change'));

    expect(onChange).not.toHaveBeenCalled();
  });
});
