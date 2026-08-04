const SCUTTLEBUTT_NOTIFICATION_TITLE = 'Scuttlebutt';

self.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {};
    } catch {
      return { body: event.data?.text() ?? '' };
    }
  })();

  const title = typeof payload.title === 'string' ? payload.title : SCUTTLEBUTT_NOTIFICATION_TITLE;
  const options = {
    body: typeof payload.body === 'string' ? payload.body : 'You have new Scuttlebutt activity.',
    data: payload.data ?? {},
    icon: typeof payload.icon === 'string' ? payload.icon : '/scuttlebutt-mark.webp',
    badge: '/scuttlebutt-mark.webp',
    tag: typeof payload.tag === 'string' ? payload.tag : 'scuttlebutt-notification',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requestedUrl = event.notification?.data?.url;
  const url = new URL(typeof requestedUrl === 'string' ? requestedUrl : '/', self.location.origin);

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        includeUncontrolled: true,
        type: 'window',
      });
      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(url.href);
          return;
        }
      }
      await self.clients.openWindow(url.href);
    })(),
  );
});
