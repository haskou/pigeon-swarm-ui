import { PwaNotificationCapability } from '../../../../../contexts/notifications/infrastructure/browser/PwaNotificationCapability';

describe(PwaNotificationCapability.name, () => {
  it('reports unsupported environments without browser notification APIs', () => {
    const notification = Object.getOwnPropertyDescriptor(
      globalThis,
      'Notification',
    );
    const navigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Reflect.deleteProperty(globalThis, 'Notification');
    Reflect.deleteProperty(globalThis, 'navigator');

    try {
      expect(new PwaNotificationCapability().currentPermission()).toBe(
        'unsupported',
      );
    } finally {
      if (notification) {
        Object.defineProperty(globalThis, 'Notification', notification);
      }

      if (navigator) Object.defineProperty(globalThis, 'navigator', navigator);
    }
  });
});
