/* Firebase Cloud Messaging service worker (SpareBolt Admin) */
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDS9qFYSsj7bOBwUxoZfNlpQ0facDiTuRk',
  authDomain: 'sparebolt-16c25.firebaseapp.com',
  projectId: 'sparebolt-16c25',
  storageBucket: 'sparebolt-16c25.firebasestorage.app',
  messagingSenderId: '393046900320',
  appId: '1:393046900320:web:907240c429ecd07db10d05',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title =
    payload.notification?.title || payload.data?.title || 'SpareBolt Admin';
  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    data: payload.data || {},
    tag: payload.data?.notificationId || 'sparebolt-admin',
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.link || '/';
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ('focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (clients.openWindow) return clients.openWindow(url);
      }),
  );
});
