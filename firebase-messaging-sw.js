importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// نفس إعدادات مشروعك الموجودة في SOLVIX_CONFIG
firebase.initializeApp({
  apiKey: "AIzaSyA0hU8922UI-TWCDfOU1rt3LGZYNMWW0HY",
  authDomain: "solvix-95eb1.firebaseapp.com",
  projectId: "solvix-95eb1",
  appId: "1:60065264617:web:ae5af308a52bf317cad178"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: './icon-192.png'
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});