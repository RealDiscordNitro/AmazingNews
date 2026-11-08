self.addEventListener("push", e => {
    let t = e.data.json();
    
    // CRITICAL FIX: e.waitUntil forces the browser to keep the background 
    // process alive until the notification is fully rendered.
    e.waitUntil(
        self.registration.showNotification(t.title, {
            body: t.body,
            icon: t.icon,
            requireInteraction: true,
            data: { url: t.url }
        })
    );
});

self.addEventListener("notificationclick", e => {
    e.notification.close();
    e.waitUntil(clients.openWindow(e.notification.data.url));
});
