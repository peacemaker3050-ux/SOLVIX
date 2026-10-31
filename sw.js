importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA0hU8922UI-TWCDfOU1rt3LGZYNMWW0HY",
  authDomain: "solvix-95eb1.firebaseapp.com",
  projectId: "solvix-95eb1",
  appId: "1:60065264617:web:ae5af308a52bf317cad178"
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || 'SOLVIX', { body: n.body || '', icon: './icon-192.png' });
});

const CACHE = 'solvix-v9';   // ← غيّره مع كل نشر
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  // addAll متحمّل لفشل ملف واحد بدل ما يوقع الـ install كله
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(ASSETS.map((a) => c.add(a)))));
});

self.addEventListener('message', (e) => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(
    fetch(r, { cache: 'no-store' })
      .then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); return res; })
      .catch(() => caches.match(r).then((m) => m || caches.match('./index.html')))
  );
});