const cacheVersion = 'pigeon-swarm-v1';
const notificationBadge = '/favicon/notification-badge.png';
const appShell = [
  '/',
  '/favicon/site.webmanifest',
  '/favicon/android-chrome-192x192.png',
  '/favicon/android-chrome-512x512.png',
  '/favicon/apple-touch-icon.png',
  notificationBadge,
  '/logo.png',
  '/connectionLost.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(cacheVersion)
      .then((cache) => cache.addAll(appShell))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== cacheVersion)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;
  if (request.headers.has('range')) return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (
    url.pathname.startsWith('/node_modules/.vite/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/src/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (!canCacheResponse(response)) return response;

          const copy = response.clone();

          caches
            .open(cacheVersion)
            .then((cache) => cache.put('/', copy))
            .catch(() => undefined);

          return response;
        })
        .catch(() => caches.match('/')),
    );

    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request)
          .then((response) => {
            if (!canCacheResponse(response)) return response;

            const copy = response.clone();

            caches
              .open(cacheVersion)
              .then((cache) => cache.put(request, copy))
              .catch(() => undefined);

            return response;
          })
          .catch(() => cached ?? Response.error()),
    ),
  );
});

function canCacheResponse(response) {
  return response.ok && response.status === 200 && response.type === 'basic';
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  const url = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    Promise.all([closeVisibleNotifications(), openOrFocusClient(url)]),
  );
});

async function closeVisibleNotifications() {
  try {
    const notifications = await self.registration.getNotifications();

    notifications.forEach((notification) => notification.close());
  } catch {
    // The clicked notification should still be closed even if listing fails.
  }
}

async function openOrFocusClient(url) {
  const clients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window',
  });
  const focusedClient = clients.find((client) => client.url === url);

  if (focusedClient) return await focusedClient.focus();

  return await self.clients.openWindow(url);
}

self.addEventListener('push', (event) => {
  const payload = pushPayload(event.data);

  if (!payload) return;

  event.waitUntil(showPushNotification(payload));
});

async function showPushNotification(payload) {
  await self.registration.showNotification(payload.title, {
    badge: payload.badge || notificationBadge,
    body: payload.body,
    data: {
      ...payload.data,
      url: payload.url || '/',
    },
    icon: payload.icon || '/favicon/android-chrome-192x192.png',
    tag: payload.tag,
  });
}

function pushPayload(data) {
  if (!data) {
    return {
      body: '',
      title: 'Pigeon Swarm',
      url: '/',
    };
  }

  try {
    const payload = data.json();

    if (!payload || typeof payload !== 'object') return null;
    const payloadDataValue = payloadData(payload.data);
    const title =
      typeof payload.title === 'string' ? payload.title : 'Pigeon Swarm';
    const body =
      typeof payload.body === 'string' ? payload.body : '';

    return {
      badge: typeof payload.badge === 'string' ? payload.badge : undefined,
      body: notificationBody(payload, payloadDataValue, body),
      data: payloadDataValue,
      icon: typeof payload.icon === 'string' ? payload.icon : undefined,
      tag: typeof payload.tag === 'string' ? payload.tag : undefined,
      title: notificationTitle(payload, payloadDataValue, title),
      url: typeof payload.url === 'string' ? payload.url : '/',
    };
  } catch {
    return {
      body: data.text(),
      title: 'Pigeon Swarm',
      url: '/',
    };
  }
}

function payloadData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  return value;
}

function notificationBody(payload, data, body) {
  if (!isMessagePayload(payload)) return body;

  const fallback = messagePushBody(data);

  return isGenericMessageBody(body) ? fallback : body || fallback;
}

function notificationTitle(payload, data, title) {
  if (!isMessagePayload(payload) || !isGenericMessageTitle(title)) return title;

  const communityName = stringValue(data.communityName);
  const channelName = stringValue(data.channelName);
  const authorName = stringValue(data.authorName) || stringValue(data.username);

  if (communityName && channelName) return `${communityName} #${channelName}`;

  if (communityName) return communityName;

  return authorName || title;
}

function messagePushBody(data) {
  const plaintext = plaintextPayloadContent(
    stringValue(data.plaintextPayload) || stringValue(data.plaintext_payload),
  );

  if (plaintext) return truncateNotificationBody(plaintext);

  return attachmentPushBody(data) || localizedMessageCopy().newMessage;
}

function plaintextPayloadContent(value) {
  const payload = stringValue(value)?.trim();

  if (!payload) return undefined;

  try {
    const parsed = JSON.parse(payload);

    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof parsed.content === 'string' &&
      parsed.content.trim()
    ) {
      return parsed.content.trim();
    }
  } catch {
    return payload;
  }

  return payload;
}

function attachmentPushBody(data) {
  const attachments = attachmentsFromData(data);

  if (attachments.length > 0) {
    const imageCount = attachments.filter(isImageAttachmentData).length;

    if (imageCount > 1) return localizedMessageCopy().sentAlbum;

    if (imageCount === 1) return localizedMessageCopy().sentPhoto;

    return localizedMessageCopy().sentFile;
  }

  const attachmentKind =
    stringValue(data.attachmentKind) || stringValue(data.attachment_kind);

  if (attachmentKind === 'album') return localizedMessageCopy().sentAlbum;

  if (attachmentKind === 'photo' || attachmentKind === 'image') {
    return localizedMessageCopy().sentPhoto;
  }

  if (
    attachmentKind === 'file' ||
    arrayValue(data.attachmentExternalIdentifiers).length > 0 ||
    arrayValue(data.attachment_external_identifiers).length > 0
  ) {
    return localizedMessageCopy().sentFile;
  }

  return undefined;
}

function attachmentsFromData(data) {
  const direct = arrayValue(data.attachments);

  if (direct.length > 0) return direct.filter(isRecord);

  const message = recordValue(data.message);

  return arrayValue(message?.attachments).filter(isRecord);
}

function isImageAttachmentData(attachment) {
  const contentType = stringValue(attachment.contentType)?.toLowerCase() || '';
  const filename = stringValue(attachment.filename) || '';

  return (
    contentType.startsWith('image/') ||
    /\.(avif|gif|jpe?g|png|webp)$/i.test(filename)
  );
}

function localizedMessageCopy() {
  const language = self.navigator?.language || '';

  if (language.toLowerCase().startsWith('es')) {
    return {
      newMessage: 'Nuevo mensaje',
      sentAlbum: 'Ha enviado un album',
      sentFile: 'Ha enviado un archivo',
      sentPhoto: 'Ha enviado una foto',
    };
  }

  return {
    newMessage: 'New message',
    sentAlbum: 'Sent an album',
    sentFile: 'Sent a file',
    sentPhoto: 'Sent a photo',
  };
}

function isMessagePayload(payload) {
  return stringValue(payload.type) === 'message';
}

function isGenericMessageBody(body) {
  const normalized = body.trim().toLowerCase();

  return (
    !normalized ||
    normalized === 'new message' ||
    normalized === 'nuevo mensaje' ||
    normalized === 'you have a new message.' ||
    normalized === 'you have a new message'
  );
}

function isGenericMessageTitle(title) {
  const normalized = title.trim().toLowerCase();

  return (
    !normalized ||
    normalized === 'pigeon swarm' ||
    normalized === 'new message' ||
    normalized === 'new community message' ||
    normalized === 'nuevo mensaje' ||
    normalized === 'nuevo mensaje de comunidad'
  );
}

function truncateNotificationBody(value) {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 160) return normalized;

  return `${normalized.slice(0, 159).trimEnd()}…`;
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function recordValue(value) {
  return isRecord(value) ? value : undefined;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
