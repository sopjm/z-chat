const http = require("http");

const PORT = process.env.PORT || 3000;
const MAX_USERS_PER_ROOM = 6;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

let rooms = {};

const userIconSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
  '<rect width="512" height="512" rx="110" fill="#111111"/>',
  '<text x="50%" y="43%" text-anchor="middle" font-size="170" font-weight="900" fill="#ffffff" font-family="Arial">Z</text>',
  '<text x="50%" y="64%" text-anchor="middle" font-size="56" font-weight="800" fill="#f7e600" font-family="Arial">CHAT</text>',
  '<text x="50%" y="82%" text-anchor="middle" font-size="70" fill="#f7e600">⚡</text>',
  '</svg>'
].join("");

const adminIconSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
  '<rect width="512" height="512" rx="110" fill="#111111"/>',
  '<text x="50%" y="43%" text-anchor="middle" font-size="140" font-weight="900" fill="#ffffff" font-family="Arial">Z</text>',
  '<text x="50%" y="64%" text-anchor="middle" font-size="56" font-weight="800" fill="#f7e600" font-family="Arial">ADMIN</text>',
  '<text x="50%" y="82%" text-anchor="middle" font-size="70" fill="#f7e600">👑</text>',
  '</svg>'
].join("");

const manifestUser = JSON.stringify({
  name: "Z Chat",
  short_name: "Z Chat",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#111111",
  theme_color: "#111111",
  orientation: "portrait",
  icons: [
    { src: "/icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
    { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
  ]
});

const manifestAdmin = JSON.stringify({
  name: "Z Admin",
  short_name: "Z Admin",
  start_url: "/z-admin",
  scope: "/",
  display: "standalone",
  background_color: "#111111",
  theme_color: "#111111",
  orientation: "any",
  icons: [
    { src: "/admin-icon.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any maskable" },
    { src: "/admin-icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any maskable" }
  ]
});

const serviceWorker = [
  'self.addEventListener("install", event => {',
  '  self.skipWaiting();',
  '});',
  '',
  'self.addEventListener("activate", event => {',
  '  event.waitUntil(self.clients.claim());',
  '});',
  '',
  'self.addEventListener("fetch", event => {',
  '  event.respondWith(fetch(event.request));',
  '});',
  '',
  'self.addEventListener("message", event => {',
  '  const data = event.data || {};',
  '  if (data.type === "SHOW_NOTIFICATION") {',
  '    self.registration.showNotification(data.title || "Z Chat", {',
  '      body: data.body || "새 메시지가 도착했습니다.",',
  '      icon: data.icon || "/icon.svg",',
  '      badge: data.icon || "/icon.svg",',
  '      vibrate: [200, 100, 200],',
  '      data: { url: data.url || "/" }',
  '    });',
  '  }',
  '});',
  '',
  'self.addEventListener("notificationclick", event => {',
  '  event.notification.close();',
  '  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";',
  '  event.waitUntil(clients.openWindow(url));',
  '});'
].join("\n");

const html = String.raw`
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>__TITLE__</title>
<link rel="manifest" href="__MANIFEST__">
<link rel="icon" href="__ICON__">
<link rel="apple-touch-icon" href="__ICON__">
<meta name="theme-color" content="#111111">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="__TITLE__">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta property="og:title" content="__TITLE__">
<meta property="og:description" content="초대코드로 들어오는 채팅방">
<meta property="og:image" content="__ICON__">
<meta property="og:type" content="website">

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #111;
  color: white;
  font-family: Arial, sans-serif;
}

#loading {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 15px;
}

.lightning {
  font-size: 80px;
  animation: flash 0.8s infinite alternate;
}

.logo {
  font-size: 42px;
  font-weight: 900;
  letter-spacing: 6px;
}

@keyframes flash {
  from { opacity: 0.35; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1.15); }
}

.app {
  width: 100%;
  height: 100dvh;
  background: #2b2b2b;
  display: flex;
  flex-direction: column;
}

@media (min-width: 700px) {
  .app {
    max-width: 460px;
    margin: auto;
  }
}

@media (orientation: landscape) and (max-height: 600px) {
  .app { max-width: 900px; }
  .header { min-height: 52px; font-size: 18px; }
  .page { padding: 12px; }
  .card { padding: 16px; }
  #messages { padding: 10px 18px; }
  .msg { max-width: 60%; }
}

.header {
  min-height: 62px;
  background: #181818;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  border-bottom: 1px solid #444;
  font-size: 22px;
  font-weight: 700;
  padding: 0 80px;
}

.leave-btn {
  position: absolute;
  left: 12px;
  background: #333;
  color: white;
  border: none;
  padding: 9px 12px;
  border-radius: 10px;
}

.settings-btn {
  position: absolute;
  right: 12px;
  background: #333;
  color: white;
  border: none;
  padding: 9px 12px;
  border-radius: 10px;
}

.page {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
}

.card {
  background: #3a3a3a;
  border-radius: 22px;
  padding: 22px;
  text-align: center;
  margin-bottom: 16px;
}

.card h2 { margin-bottom: 10px; }
.card p { opacity: 0.8; margin-bottom: 16px; }

.card input {
  width: 100%;
  margin-top: 10px;
  padding: 15px;
  border: none;
  border-radius: 14px;
  background: #1f1f1f;
  color: white;
  font-size: 16px;
  outline: none;
}

.card button {
  width: 100%;
  margin-top: 12px;
  padding: 15px;
  border: none;
  border-radius: 14px;
  background: white;
  color: black;
  font-size: 16px;
  font-weight: bold;
}

.sub-btn {
  background: #555 !important;
  color: white !important;
}

.room-item {
  background: #1f1f1f;
  border: 1px solid #444;
  border-radius: 16px;
  padding: 15px;
  margin-top: 10px;
}

.room-item-title {
  font-size: 18px;
  font-weight: bold;
}

.room-item-sub {
  margin-top: 4px;
  font-size: 13px;
  opacity: 0.7;
}

#chatPage {
  display: none;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.status {
  padding: 9px;
  text-align: center;
  background: #333;
  font-size: 13px;
}

#messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.msg-wrap {
  display: flex;
  margin: 10px 0;
}

.msg-wrap.mine { justify-content: flex-end; }
.msg-wrap.other { justify-content: flex-start; }

.msg {
  max-width: 76%;
  padding: 11px 13px;
  border-radius: 18px;
  word-break: break-word;
}

.msg.mine {
  background: #f7e600;
  color: black;
  border-bottom-right-radius: 5px;
}

.msg.other {
  background: #444;
  color: white;
  border-bottom-left-radius: 5px;
}

.name {
  font-size: 12px;
  margin-bottom: 5px;
  opacity: 0.7;
  font-weight: bold;
}

.chat-img,
.chat-video {
  width: 100%;
  border-radius: 14px;
  margin-top: 6px;
}

.input-area {
  display: flex;
  gap: 6px;
  padding: 10px;
  background: #181818;
  border-top: 1px solid #444;
}

.input-area input[type="text"] {
  flex: 1;
  border: none;
  border-radius: 14px;
  padding: 13px;
  background: #333;
  color: white;
  font-size: 15px;
  outline: none;
  min-width: 0;
}

.input-area button {
  border: none;
  border-radius: 14px;
  padding: 13px;
  background: white;
  color: black;
  font-weight: bold;
}

.file-btn {
  background: #555 !important;
  color: white !important;
}

.toggle-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1f1f1f;
  padding: 14px;
  border-radius: 14px;
  margin-top: 10px;
  text-align: left;
}

.toggle-row span { font-size: 15px; }

.toggle-row button {
  width: auto;
  margin: 0;
  padding: 10px 14px;
}

.small-note {
  color: #bbb;
  font-size: 13px;
  line-height: 1.5;
  margin-top: 12px;
  text-align: left;
}
</style>
</head>

<body>
<div id="loading">
  <div class="lightning">⚡</div>
  <div class="logo">__LOGO__</div>
</div>

<div class="app">
  <div class="header">
    <button id="leaveBtn" class="leave-btn" onclick="leaveRoom()" style="display:none;">나가기</button>
    <span>__HEADER__</span>
    <button id="settingsBtn" class="settings-btn" onclick="showSettings()">설정</button>
  </div>

  <div id="mainPage" class="page">
    <div class="card">
      <h2>관리자 화면</h2>
      <p>방을 만들거나 들어가세요</p>
      <button onclick="showCreateRoom()">방 만들기</button>
      <button class="sub-btn" onclick="showJoinRoom()">방 들어가기</button>
    </div>

    <div class="card" id="adminStatsBox">
      <h2>관리자 통계</h2>
      <p id="totalUsersText">전체 접속자: 0명</p>
      <div id="roomStats"></div>
    </div>

    <div id="myRooms"></div>
  </div>

  <div id="createPage" class="page" style="display:none;">
    <div class="card">
      <h2>방 만들기</h2>
      <input id="createCode" placeholder="방 코드">
      <input id="createName" placeholder="내 이름">
      <button onclick="createRoom()">방 만들기</button>
      <button class="sub-btn" onclick="goMain()">뒤로가기</button>
    </div>
  </div>

  <div id="joinPage" class="page" style="display:none;">
    <div class="card">
      <h2>방 들어가기</h2>
      <input id="joinCode" placeholder="방 코드">
      <input id="joinName" placeholder="내 이름">
      <button onclick="joinRoom()">입장하기</button>
    </div>
  </div>

  <div id="settingsPage" class="page" style="display:none;">
    <div class="card">
      <h2>알림 설정</h2>

      <div class="toggle-row">
        <span>새 메시지 알림</span>
        <button id="notiToggle" onclick="toggleNotifications()">확인중</button>
      </div>

      <div class="toggle-row">
        <span>알림 소리</span>
        <button id="soundToggle" onclick="toggleSound()">확인중</button>
      </div>

      <button class="sub-btn" onclick="backFromSettings()">돌아가기</button>

      <div class="small-note">
        지금 알림은 앱/브라우저가 백그라운드에 살아있을 때 작동합니다.<br>
        카톡처럼 완전히 꺼진 상태 푸시는 Web Push 서버 구성이 더 필요합니다.
      </div>
    </div>
  </div>

  <div id="chatPage">
    <div class="status" id="status">접속중...</div>
    <div id="messages"></div>

    <div class="input-area">
      <button class="file-btn" onclick="document.getElementById('fileInput').click()">＋</button>
      <input id="fileInput" type="file" accept="image/*,video/*" style="display:none" onchange="sendFile()">
      <input id="text" type="text" placeholder="메시지 입력">
      <button onclick="sendText()">전송</button>
    </div>
  </div>
</div>

<script>
const IS_ADMIN = "__IS_ADMIN__";
const MAX_UPLOAD_SIZE_CLIENT = __MAX_UPLOAD_SIZE__;

let userId = localStorage.getItem("z_userId");
let userName = localStorage.getItem("z_userName") || "";
let roomCode = "";
let messageTimer = null;
let enterTimer = null;
let adminTimer = null;
let lastMessageIds = new Set();
let firstMessageLoad = true;
let notificationsEnabled = localStorage.getItem("z_notifications") === "true";
let soundEnabled = localStorage.getItem("z_sound") !== "false";

if (!userId) {
  userId = Math.random().toString(36).substring(2);
  localStorage.setItem("z_userId", userId);
}

setTimeout(function () {
  document.getElementById("loading").style.display = "none";
  document.getElementById("joinName").value = userName;
  document.getElementById("createName").value = userName;
  updateSettingsButtons();

  if (IS_ADMIN === "true") {
    goMain();
  } else {
    showJoinRoomForGuest();
  }
}, 1200);

function hideAllPages() {
  document.getElementById("mainPage").style.display = "none";
  document.getElementById("createPage").style.display = "none";
  document.getElementById("joinPage").style.display = "none";
  document.getElementById("settingsPage").style.display = "none";
  document.getElementById("chatPage").style.display = "none";
}

function stopTimers() {
  if (messageTimer) clearInterval(messageTimer);
  if (enterTimer) clearInterval(enterTimer);
  if (adminTimer) clearInterval(adminTimer);
}

function goMain() {
  stopTimers();
  hideAllPages();
  document.getElementById("mainPage").style.display = "block";
  document.getElementById("leaveBtn").style.display = "none";
  renderRooms();
  loadAdminStats();
  adminTimer = setInterval(loadAdminStats, 3000);
}

function showCreateRoom() {
  hideAllPages();
  document.getElementById("createPage").style.display = "block";
}

function showJoinRoom() {
  hideAllPages();
  document.getElementById("joinPage").style.display = "block";
}

function showJoinRoomForGuest() {
  const savedRooms = JSON.parse(localStorage.getItem("z_rooms") || "[]");

  if (savedRooms.length > 0 && userName) {
    roomCode = savedRooms[0];
    startChat();
    return;
  }

  hideAllPages();
  document.getElementById("joinPage").style.display = "block";
}

function showSettings() {
  hideAllPages();
  document.getElementById("settingsPage").style.display = "block";
}

function backFromSettings() {
  if (roomCode) {
    hideAllPages();
    document.getElementById("chatPage").style.display = "flex";
    return;
  }

  if (IS_ADMIN === "true") {
    goMain();
  } else {
    showJoinRoomForGuest();
  }
}

function updateSettingsButtons() {
  const noti = document.getElementById("notiToggle");
  const sound = document.getElementById("soundToggle");

  if (noti) noti.innerText = notificationsEnabled ? "켜짐" : "꺼짐";
  if (sound) sound.innerText = soundEnabled ? "켜짐" : "꺼짐";
}

async function toggleNotifications() {
  if (!notificationsEnabled) {
    if (!("Notification" in window)) {
      alert("이 브라우저는 알림을 지원하지 않아.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("알림 권한이 허용되지 않았어.");
      return;
    }

    notificationsEnabled = true;
  } else {
    notificationsEnabled = false;
  }

  localStorage.setItem("z_notifications", String(notificationsEnabled));
  updateSettingsButtons();
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem("z_sound", String(soundEnabled));
  updateSettingsButtons();

  if (soundEnabled) playBeep();
}

function saveRoom(code) {
  let savedRooms = JSON.parse(localStorage.getItem("z_rooms") || "[]");

  if (!savedRooms.includes(code)) {
    savedRooms.unshift(code);
  }

  localStorage.setItem("z_rooms", JSON.stringify(savedRooms));
}

function renderRooms() {
  const box = document.getElementById("myRooms");
  const savedRooms = JSON.parse(localStorage.getItem("z_rooms") || "[]");

  box.innerHTML = "";

  if (savedRooms.length === 0) {
    box.innerHTML = "<div class='room-item'><div class='room-item-sub'>아직 저장된 방이 없습니다.</div></div>";
    return;
  }

  savedRooms.forEach(function (code) {
    box.innerHTML +=
      "<div class='room-item' onclick=\"openSavedRoom('" + escapeAttr(code) + "')\">" +
      "<div class='room-item-title'>" + escapeHtml(code) + "</div>" +
      "<div class='room-item-sub'>다시 입장하기</div>" +
      "</div>";
  });
}

async function loadAdminStats() {
  if (IS_ADMIN !== "true") return;

  const res = await fetch("/admin-stats");
  const data = await res.json();

  document.getElementById("totalUsersText").innerText =
    "전체 접속자: " + data.totalUsers + "명";

  const box = document.getElementById("roomStats");
  box.innerHTML = "";

  if (data.rooms.length === 0) {
    box.innerHTML = "<div class='room-item-sub'>아직 생성된 방이 없습니다.</div>";
    return;
  }

  data.rooms.forEach(function (room) {
    box.innerHTML +=
      "<div class='room-item' onclick=\"openSavedRoom('" + escapeAttr(room.code) + "')\">" +
      "<div class='room-item-title'>방 코드: " + escapeHtml(room.code) + "</div>" +
      "<div class='room-item-sub'>접속자 " + room.users + "명 / 메시지 " + room.messages + "개</div>" +
      "</div>";
  });
}

async function createRoom() {
  const code = document.getElementById("createCode").value.trim();
  const name = document.getElementById("createName").value.trim();

  if (!code) return alert("방 코드를 입력해줘");
  if (!name) return alert("이름을 입력해줘");

  userName = name;
  localStorage.setItem("z_userName", name);
  roomCode = code;

  await fetch("/create-room", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({roomCode})
  });

  saveRoom(code);
  startChat();
}

async function joinRoom() {
  const code = document.getElementById("joinCode").value.trim();
  const name = document.getElementById("joinName").value.trim();

  if (!code) return alert("방 코드를 입력해줘");
  if (!name) return alert("이름을 입력해줘");

  const res = await fetch("/check-room?room=" + encodeURIComponent(code));
  const data = await res.json();

  if (!data.exists) {
    return alert("없는 방 코드야. 방 만든 사람이 먼저 만들어야 해.");
  }

  userName = name;
  localStorage.setItem("z_userName", name);
  roomCode = code;
  saveRoom(code);
  startChat();
}

function openSavedRoom(code) {
  if (!userName) {
    const name = prompt("이름을 입력해줘");
    if (!name) return;

    userName = name;
    localStorage.setItem("z_userName", name);
  }

  roomCode = code;
  saveRoom(code);
  startChat();
}

async function startChat() {
  stopTimers();
  firstMessageLoad = true;
  lastMessageIds = new Set();
  hideAllPages();

  document.getElementById("chatPage").style.display = "flex";
  document.getElementById("leaveBtn").style.display = "block";

  await enter();
  await loadMessages();

  enterTimer = setInterval(enter, 3000);
  messageTimer = setInterval(loadMessages, 1000);
}

async function leaveRoom() {
  await fetch("/leave", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({userId, roomCode})
  });

  roomCode = "";

  if (IS_ADMIN === "true") {
    goMain();
  } else {
    showJoinRoomForGuest();
  }
}

async function enter() {
  if (!roomCode) return;

  const res = await fetch("/enter", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({userId, roomCode, userName})
  });

  const data = await res.json();

  if (!data.ok) {
    document.getElementById("status").innerText = "방이 꽉 찼습니다.";
    return;
  }

  document.getElementById("status").innerText =
    "방 코드: " + roomCode + " / 접속자: " + data.count + "/6";
}

async function loadMessages() {
  if (!roomCode) return;

  const res = await fetch("/messages?room=" + encodeURIComponent(roomCode));
  const data = await res.json();

  const box = document.getElementById("messages");
  box.innerHTML = "";

  const newOtherMessages = [];

  data.forEach(function (m) {
    const mine = m.userId === userId;
    const msgId = String(m.time) + "_" + String(m.userId) + "_" + String(m.text || m.fileName || "");

    if (!firstMessageLoad && !lastMessageIds.has(msgId) && !mine) {
      newOtherMessages.push(m);
    }

    lastMessageIds.add(msgId);

    let content = "";

    if (m.type === "image") {
      content = "<img class='chat-img' src='" + m.data + "'>";
    } else if (m.type === "video") {
      content = "<video class='chat-video' controls src='" + m.data + "'></video>";
    } else {
      content = escapeHtml(m.text);
    }

    box.innerHTML +=
      "<div class='msg-wrap " + (mine ? "mine" : "other") + "'>" +
      "<div class='msg " + (mine ? "mine" : "other") + "'>" +
      "<div class='name'>" + escapeHtml(m.name) + "</div>" +
      content +
      "</div>" +
      "</div>";
  });

  if (newOtherMessages.length > 0) {
    notifyNewMessage(newOtherMessages[newOtherMessages.length - 1]);
  }

  firstMessageLoad = false;
  box.scrollTop = box.scrollHeight;
}

async function sendText() {
  const text = document.getElementById("text").value;

  if (!text.trim()) return;

  await fetch("/send", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      userId,
      roomCode,
      name: userName,
      type: "text",
      text
    })
  });

  document.getElementById("text").value = "";
  loadMessages();
}

function sendFile() {
  const file = document.getElementById("fileInput").files[0];

  if (!file) return;

  if (file.size > MAX_UPLOAD_SIZE_CLIENT) {
    return alert("5MB 이하만 가능");
  }

  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    return alert("사진이나 영상만 가능해");
  }

  const reader = new FileReader();

  reader.onload = async function () {
    await fetch("/send", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        userId,
        roomCode,
        name: userName,
        type: file.type.startsWith("image/") ? "image" : "video",
        data: reader.result,
        fileName: file.name
      })
    });

    document.getElementById("fileInput").value = "";
    loadMessages();
  };

  reader.readAsDataURL(file);
}

function notifyNewMessage(message) {
  const body =
    message.type === "image"
      ? "사진을 보냈습니다."
      : message.type === "video"
      ? "영상을 보냈습니다."
      : (message.text || "새 메시지");

  document.title = "새 메시지! - Z Chat";

  setTimeout(function () {
    document.title = IS_ADMIN === "true" ? "Z Admin" : "Z Chat";
  }, 1500);

  if (soundEnabled) {
    playBeep();
  }

  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }

  if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SHOW_NOTIFICATION",
        title: message.name || "Z Chat",
        body,
        icon: IS_ADMIN === "true" ? "/admin-icon.svg" : "/icon.svg",
        url: location.href
      });
    } else {
      new Notification(message.name || "Z Chat", {
        body,
        icon: IS_ADMIN === "true" ? "/admin-icon.svg" : "/icon.svg"
      });
    }
  }
}

function playBeep() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();

    setTimeout(function () {
      oscillator.stop();
      ctx.close();
    }, 150);
  } catch (e) {}
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(text) {
  return String(text || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', "&quot;");
}

document.addEventListener("keydown", function (e) {
  if (e.key === "Enter" && document.getElementById("text") === document.activeElement) {
    sendText();
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").then(function (reg) {
    reg.update();
    setInterval(function () {
      reg.update();
    }, 60000);
  });
}
</script>
</body>
</html>
`;

function getRoom(code) {
  if (!rooms[code]) {
    rooms[code] = {
      messages: [],
      users: new Map()
    };
  }

  return rooms[code];
}

function cleanUsers(room) {
  const now = Date.now();

  for (const [id, info] of room.users) {
    if (now - info.time > 10000) {
      room.users.delete(id);
    }
  }
}

function readBody(req, callback) {
  let body = "";

  req.on("data", function (chunk) {
    body += chunk;

    if (body.length > 8 * 1024 * 1024) {
      req.destroy();
    }
  });

  req.on("end", function () {
    callback(body);
  });
}

function sendHtml(res, isAdmin) {
  const page = html
    .replaceAll("__IS_ADMIN__", isAdmin ? "true" : "false")
    .replaceAll("__TITLE__", isAdmin ? "Z Admin" : "Z Chat")
    .replaceAll("__MANIFEST__", isAdmin ? "/admin-manifest.json" : "/manifest.json")
    .replaceAll("__ICON__", isAdmin ? "/admin-icon.svg" : "/icon.svg")
    .replaceAll("__LOGO__", isAdmin ? "Z ADMIN" : "Z CHAT")
    .replaceAll("__HEADER__", isAdmin ? "👑 Z Admin" : "⚡ Z Chat")
    .replaceAll("__MAX_UPLOAD_SIZE__", String(MAX_UPLOAD_SIZE));

  res.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
  res.end(page);
}

const server = http.createServer(function (req, res) {
  if (req.url === "/") {
    sendHtml(res, false);
  }

  else if (req.url === "/z-admin" || req.url === "/admin") {
    sendHtml(res, true);
  }

  else if (req.url === "/manifest.json") {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(manifestUser);
  }

  else if (req.url === "/admin-manifest.json") {
    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(manifestAdmin);
  }

  else if (req.url === "/service-worker.js") {
    res.writeHead(200, {"Content-Type": "application/javascript"});
    res.end(serviceWorker);
  }

  else if (req.url === "/icon.svg") {
    res.writeHead(200, {"Content-Type": "image/svg+xml"});
    res.end(userIconSvg);
  }

  else if (req.url === "/admin-icon.svg") {
    res.writeHead(200, {"Content-Type": "image/svg+xml"});
    res.end(adminIconSvg);
  }

  else if (req.url === "/create-room" && req.method === "POST") {
    readBody(req, function (body) {
      const data = JSON.parse(body);
      const code = String(data.roomCode || "").trim();

      if (!code) {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify({ok: false, message: "방 코드 없음"}));
        return;
      }

      getRoom(code);

      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify({ok: true}));
    });
  }

  else if (req.url.startsWith("/check-room")) {
    const url = new URL(req.url, "http://localhost");
    const roomCode = url.searchParams.get("room");

    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({exists: !!rooms[roomCode]}));
  }

  else if (req.url === "/admin-stats") {
    let totalUsers = 0;
    const roomList = [];

    for (const code in rooms) {
      const room = rooms[code];
      cleanUsers(room);

      totalUsers += room.users.size;

      roomList.push({
        code,
        users: room.users.size,
        messages: room.messages.length
      });
    }

    res.writeHead(200, {"Content-Type": "application/json"});
    res.end(JSON.stringify({
      totalUsers,
      rooms: roomList
    }));
  }

  else if (req.url === "/enter" && req.method === "POST") {
    readBody(req, function (body) {
      const data = JSON.parse(body);
      const room = getRoom(data.roomCode);

      cleanUsers(room);

      if (!room.users.has(data.userId) && room.users.size >= MAX_USERS_PER_ROOM) {
        res.writeHead(200, {"Content-Type": "application/json"});
        res.end(JSON.stringify({ok: false, count: room.users.size}));
        return;
      }

      room.users.set(data.userId, {
        name: data.userName || "익명",
        time: Date.now()
      });

      res.writeHead(200, {"Content-Type": "application/json"});
      res.end(JSON.stringify({ok: true, count: room.users.size}));
    });
  }

  else if (req.url === "/leave" && req.method === "POST") {
    readBody(req, function (body) {
      const data = JSON.parse(body);
      const room = getRoom(data.roomCode);

      room.users.delete(data.userId);

      res.writeHead(200);
      res.end("OK");
    });
  }

  else if (req.url.startsWith("/messages")) {
    const url = new URL(req.url, "http://localhost");
    const roomCode = url.searchParams.get("room");
    const room = getRoom(roomCode);

    res.writeHead(200, {"Content-Type": "application/json; charset=utf-8"});
    res.end(JSON.stringify(room.messages));
  }

  else if (req.url === "/send" && req.method === "POST") {
    readBody(req, function (body) {
      const data = JSON.parse(body);
      const room = getRoom(data.roomCode);

      room.messages.push({
        userId: data.userId,
        name: data.name || "익명",
        type: data.type || "text",
        text: data.text || "",
        data: data.data || "",
        fileName: data.fileName || "",
        time: Date.now()
      });

      if (room.messages.length > 100) {
        room.messages.shift();
      }

      res.writeHead(200);
      res.end("OK");
    });
  }

  else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, "0.0.0.0", function () {
  console.log("Z Chat 서버 실행됨!");
  console.log("PORT:", PORT);
});
