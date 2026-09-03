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
// オフライン・キャッシュ管理機能
// =========================================================
self.addEventListener('fetch', event => {
  // ① HTMLファイル（UI画面）へのアクセスの場合
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // オンラインなら最新版を取得して保存
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => {
          // ★修正: オフライン時のエラー対応
          // インターネット接続がない場合は、保存してあるキャッシュを返す。
          // リクエストされたURLのキャッシュがない場合はルート('./')のHTMLを強制的に表示する。
          return cachedResponse || caches.match('./index.html') || caches.match('./');
        });

        // キャッシュがあれば待たずにすぐ画面を出す。無ければネットワークの完了を待つ。
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // ② 画像やその他のファイルは「キャッシュ優先 (Cache First)」
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(fetchRes => {
        return caches.open(CACHE_NAME).then(cache => {
          if (event.request.url.startsWith('http')) {
            cache.put(event.request, fetchRes.clone());
          }
          return fetchRes;
        });
      }).catch(() => {
         // 通信エラー時（オフライン時で未キャッシュの画像を読み込もうとした場合など）は何もしない
         console.log('オフラインのため取得スキップ:', event.request.url);
      });
    })
  );
});
