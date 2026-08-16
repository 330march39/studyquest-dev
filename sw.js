// sw.js

let focusTimerTimeout = null; // 集中モード専用のタイマー
let questTimerTimeout = null; // クエスト専用のタイマー

// 全通知共通のタグ名
const NOTIFICATION_TAG = 'study-quest-notification';

// ★追加: キャッシュの名前（バージョン管理用）
const CACHE_NAME = 'study-quest-cache-v2';

self.addEventListener('install', event => {
  console.log('SW: インストール');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('SW: 有効化');
  // ★追加: 古いキャッシュが残っていたら削除して常にクリーンにする
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
  
  // ★変更: 'command' または 'type' のどちらかで命令を受け取れるようにする
  const command = event.data.command || event.data.type;

  // --- ★追加: キャッシュを最新に切り替える命令を受け取った時の処理 ---
  if (command === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  // --- 1. 集中モードのタイマー開始 ---
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
  } 

  // --- 2. 集中モードのタイマー停止 ---
  else if (command === 'focusTimer_stop') {
    if (focusTimerTimeout) {
      clearTimeout(focusTimerTimeout);
      focusTimerTimeout = null;
    }
  } 

  // --- 3. クエストのタイマー開始 ---
  else if (command === 'questTimer_start') {
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
  }

  // --- 4. クエストのタイマー停止 ---
  else if (command === 'questTimer_stop') {
    if (questTimerTimeout) {
      clearTimeout(questTimerTimeout);
      questTimerTimeout = null;
    }
  }

  // --- 5. クエストの「即時」通知 ---
  else if (command === 'showQuestNotification') {
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
// ★追加: キャッシュ管理機能 (古いUIが表示されるバグの修正)
// =========================================================
self.addEventListener('fetch', event => {
  // ① HTMLファイル（画面の構造）は「常に最新を通信で取得する」
  if (event.request.mode === 'navigate' || (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 通信成功：最新のHTMLをキャッシュに保存して画面に返す
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // 通信失敗（オフラインやクラッシュ復帰時）：仕方ないので保存されているキャッシュを返す
          return caches.match(event.request);
        })
    );
    return;
  }

  // ② 画像などのファイルは「一度保存したらキャッシュを優先する（通信量節約）」
  event.respondWith(
    caches.match(event.request).then(response => {
      // キャッシュがあればそれを返す、無ければ通信して取得する
      return response || fetch(event.request).then(fetchRes => {
        return caches.open(CACHE_NAME).then(cache => {
          // http/httpsリクエストの場合のみキャッシュに保存する（拡張機能由来のエラー防止）
          if (event.request.url.startsWith('http')) {
            cache.put(event.request, fetchRes.clone());
          }
          return fetchRes;
        });
      });
    }).catch(() => {
      // オフラインで画像もない場合は何もしない
    })
  );
});
