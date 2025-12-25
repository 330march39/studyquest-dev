// sw.js

let focusTimerTimeout = null; // 集中モード専用のタイマー
let questTimerTimeout = null; // クエスト専用のタイマー

// ★変更点: 全通知共通のタグ名を定義（これにより通知が上書きされます）
const NOTIFICATION_TAG = 'study-quest-notification';

self.addEventListener('install', event => {
  console.log('SW: インストール');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('SW: 有効化');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', event => {
  if (!event.data) return;
  const { command } = event.data;

  // --- 1. 集中モードのタイマー開始 ---
  if (command === 'focusTimer_start') {
    const { timeLeft, title, body } = event.data;
    if (focusTimerTimeout) clearTimeout(focusTimerTimeout);
    
    event.waitUntil(
      new Promise(resolve => {
        focusTimerTimeout = setTimeout(() => {
          self.registration.showNotification(title, {
            body: body,
            tag: NOTIFICATION_TAG, // ★共通タグに変更
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
    // タイマーキャンセル時に既存の通知も消したい場合は以下を有効化
    // self.registration.getNotifications({ tag: NOTIFICATION_TAG }).then(n => n.forEach(x => x.close()));
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
            tag: NOTIFICATION_TAG, // ★共通タグに変更
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
        tag: NOTIFICATION_TAG, // ★共通タグに変更
        icon: 'https://placehold.co/180x180/4f46e5/ffffff?text=Q',
        renotify: true // 上書き時にも音/バイブを鳴らす設定
      })
    );
  }
});
