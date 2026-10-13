import { listCallMicrophones } from '../../../../../contexts/calls/infrastructure/media/listCallMicrophones';

function device(
  kind: MediaDeviceKind,
  deviceId: string,
  label: string,
): MediaDeviceInfo {
  return { deviceId, groupId: '', kind, label } as MediaDeviceInfo;
}

describe('listCallMicrophones', () => {
  it('lists the microphones a call can choose from', async () => {
    const mediaDevices = {
      enumerateDevices: jest
        .fn()
        .mockResolvedValue([
          device('audioinput', 'default', 'Default - USB microphone'),
          device('audioinput', 'communications', 'Communications - Headset'),
          device('audioinput', 'usb-microphone', 'USB microphone'),
          device('audiooutput', 'speakers', 'Speakers'),
          device('videoinput', 'camera', 'Camera'),
          device('audioinput', 'headset', ''),
        ]),
    };

    await expect(listCallMicrophones(mediaDevices)).resolves.toEqual([
      { deviceId: 'usb-microphone', label: 'USB microphone' },
      { deviceId: 'headset', label: '' },
    ]);
  });

  it('hides microphones the browser has not identified yet', async () => {
    const mediaDevices = {
      enumerateDevices: jest
        .fn()
        .mockResolvedValue([device('audioinput', '', '')]),
    };

    await expect(listCallMicrophones(mediaDevices)).resolves.toEqual([]);
  });

  it('lists nothing when the browser cannot enumerate devices', async () => {
    await expect(listCallMicrophones(undefined)).resolves.toEqual([]);
    await expect(
      listCallMicrophones({
        enumerateDevices: jest.fn().mockRejectedValue(new Error('blocked')),
      }),
    ).resolves.toEqual([]);
  });
});
