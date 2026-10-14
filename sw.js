// sw.js

let focusTimerTimeout = null; // 集中モード専用のタイマー
let questTimerTimeout = null; // クエスト専用のタイマー

// 全通知共通のタグ名
const NOTIFICATION_TAG = 'study-quest-notification';

// ★修正: キャッシュの名前（バージョンを上げて新しい仕組みを適用させます）
const CACHE_NAME = 'study-quest-cache-v3';

// ★追加: アプリがオフラインで動くために「絶対に保存しておくべきファイル」のリスト
// ※「index.html」の部分は、実際のあなたのHTMLファイル名に合わせてください。
const urlsToCache = [
  './',
  './index.html', 
  './manifest.json',
  './SQ_logo.png',
  './SQ_logo2.png',
  './SQ_logo3.png',
  './SQ_logo4.png',
  './SQ_logo5.png',
  './coin.png'
];

self.addEventListener('install', event => {
  console.log('SW: インストール');
  // ★追加: インストールされた瞬間に、必要なファイルを強制的にダウンロードして保存する
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('必要なファイルを事前にキャッシュします');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('SW: 有効化');
  // 古いキャッシュが残っていたら削除して常にクリーンにする
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => cacheName !== CACHE_NAME)
                  .map(cacheName => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (!event.data) return;
  const command = event.data.command || event.data.type;

  if (command === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // --- 通知タイマー処理 ---
  if (command === 'focusTimer_start') {
    const { timeLeft, title, body } = event.data;
    if (focusTimerTimeout) clearTimeout(focusTimerTimeout);
    event.waitUntil(
      new Promise(resolve => {
        focusTimerTimeout = setTimeout(() => {
          self.registration.showNotification(title, {
            body: body,
            tag: NOTIFICATION_TAG,
            icon: 'https://placehold.co/180x180/4f46e5/ffffff?text=Q',
            renotify: true
          }).then(() => {
            focusTimerTimeout = null;
            resolve();
          });
        }, timeLeft * 1000);
      })
    );
  } else if (command === 'focusTimer_stop') {
    if (focusTimerTimeout) {
      clearTimeout(focusTimerTimeout);
      focusTimerTimeout = null;
    }
  } else if (command === 'questTimer_start') {
    const { timeLeft, title, body } = event.data;
    if (questTimerTimeout) clearTimeout(questTimerTimeout);
    event.waitUntil(
      new Promise(resolve => {
        questTimerTimeout = setTimeout(() => {
          self.registration.showNotification(title, {
            body: body,
            tag: NOTIFICATION_TAG,
            icon: 'https://placehold.co/180x180/4f46e5/ffffff?text=Q',
            renotify: true
          }).then(() => {
            questTimerTimeout = null;
            resolve();
          });
        }, timeLeft * 1000);
      })
    );
  } else if (command === 'questTimer_stop') {
    if (questTimerTimeout) {
      clearTimeout(questTimerTimeout);
      questTimerTimeout = null;
    }
  } else if (command === 'showQuestNotification') {
    const { title, body } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, { 
        body: body,
        tag: NOTIFICATION_TAG,
        icon: 'https://placehold.co/180x180/4f46e5/ffffff?text=Q',
        renotify: true
      })
    );
  }
});

// =========================================================
// オフライン・キャッシュ管理機能（完全Cache First ＋ 更新チェック対応版）
// =========================================================
self.addEventListener('fetch', event => {
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // ★追加: アップデート確認用の通信（?t=... がついているもの）はキャッシュせず直接ネットへ通す
  if (event.request.url.includes('?t=')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // ① HTMLファイル（UI画面）へのアクセスの場合
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      caches.match(event.request).then(async cachedResponse => {
        // ★修正: キャッシュがあれば、裏で通信せず【即座にキャッシュだけを返す】
        // （ここで勝手にキャッシュを上書きしないことで、アプリ側の差分チェックが正しく動くようになります）
        if (cachedResponse) {
          return cachedResponse;
        }

        // URL末尾の違い（'/' と './index.html'）でヒットしなかった場合の保険
        const fallbackCache = await caches.match('./index.html') || await caches.match('./');
        if (fallbackCache) {
          return fallbackCache;
        }

        // キャッシュが全くない時（初回起動時・またはアップデートボタンを押してキャッシュ削除した直後）のみネットから取得して保存
        return fetch(event.request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => {
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
    );
    return;
  }

  // ② 画像やその他のファイルは「キャッシュ優先 (Cache First)」
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(fetchRes => {
        if (fetchRes && fetchRes.status === 200) {
          const responseToCache = fetchRes.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return fetchRes;
      }).catch(() => {
         console.log('オフラインのため取得スキップ:', event.request.url);
         return new Response(null, { status: 503, statusText: 'Offline' });
      });
    })
  );
});
// =========================================================
// ▼▼▼ 追加: 通知をタップしたときの処理（別のPWAが開くのを防ぐ） ▼▼▼
// =========================================================
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  // ★重要: アプリのURLパスを正確に指定します。
  // './index.html' とすることで、現在のsw.jsと同じ階層のindex.htmlを開きます。
  const targetUrl = new URL('./index.html', self.location.href).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // すでにアプリの画面が開いていれば、そこにフォーカスを合わせる
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        // URLがこのアプリのものかチェック
        if (client.url === targetUrl || client.url === new URL('./', self.location.href).href) {
          if ('focus' in client) {
            return client.focus();
          }
        }
      }
      // まだ開いていなければ新しくウィンドウを開く
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
// ▲▲▲ 追加ここまで ▲▲▲
