const http = require("http");

const PORT = process.env.PORT || 3000;
const MAX_USERS_PER_ROOM = 6;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

let rooms = {};

const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>Z Chat</title>

<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#111111">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<meta property="og:title" content="Z Chat">
<meta property="og:description" content="초대코드로 들어오는 6인 채팅방">
<meta property="og:image" content="https://via.placeholder.com/300x300/000000/ffffff.png?text=Z">
<meta property="og:type" content="website">

<style>
* { box-sizing: border-box; }

body {
  margin: 0;
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
  font-size: 34px;
  font-weight: bold;
  letter-spacing: 5px;
}

@keyframes flash {
  from { opacity: 0.35; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1.15); }
}

.app {
  max-width: 460px;
  height: 100vh;
  margin: 0 auto;
  background: #2b2b2b;
  display: flex;
  flex-direction: column;
}

.header {
  background: #181818;
  padding: 16px;
  text-align: center;
  font-size: 22px;
  font-weight: bold;
  border-bottom: 1px solid #444;
  position: relative;
}

.leave-btn {
  position: absolute;
  left: 10px;
  top: 12px;
  background: #333;
  color: white;
  border: 1px solid #555;
  border-radius: 10px;
  padding: 7px 10px;
  cursor: pointer;
  display: none;
}

.page {
  flex: 1;
  padding: 18px;
  overflow-y: auto;
}

.card {
  width: 100%;
  background: #3a3a3a;
  padding: 22px;
  border-radius: 18px;
  text-align: center;
  box-shadow: 0 0 20px rgba(0,0,0,0.4);
  margin-bottom: 14px;
}

.card input {
  width: 100%;
  margin-top: 12px;
  padding: 15px;
  border: none;
  border-radius: 12px;
  font-size: 17px;
  background: #1f1f1f;
  color: white;
  outline: none;
}

.card button {
  width: 100%;
  margin-top: 12px;
  padding: 15px;
  border: none;
  border-radius: 12px;
  background: white;
  color: black;
  font-size: 17px;
  font-weight: bold;
  cursor: pointer;
}

.sub-btn {
  background: #555 !important;
  color: white !important;
}

.room-list-title {
  font-size: 15px;
  color: #ccc;
  margin: 18px 0 10px;
}

.room-item {
  background: #1f1f1f;
  padding: 14px;
  border-radius: 14px;
  margin-bottom: 10px;
  cursor: pointer;
  border: 1px solid #444;
}

.room-name {
  font-size: 17px;
  font-weight: bold;
}

.room-sub {
  color: #aaa;
  font-size: 13px;
  margin-top: 4px;
}

#chatPage {
  display: none;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.status {
  padding: 9px;
  text-align: center;
  font-size: 13px;
  background: #333;
  color: #ccc;
}

#messages {
  flex: 1;
  overflow-y: auto;
  padding: 14px;
  background: #2b2b2b;
}

.msg-wrap {
  display: flex;
  margin: 8px 0;
}

.msg-wrap.mine {
  justify-content: flex-end;
}

.msg-wrap.other {
  justify-content: flex-start;
}

.msg {
  max-width: 75%;
  padding: 10px 13px;
  border-radius: 16px;
  line-height: 1.4;
  word-break: break-word;
}

.msg.mine {
  background: #f7e600;
  color: #111;
  border-bottom-right-radius: 4px;
}

.msg.other {
  background: #444;
  color: white;
  border-bottom-left-radius: 4px;
}

.name {
  font-size: 12px;
  margin-bottom: 4px;
  font-weight: bold;
  opacity: 0.75;
}

.chat-img, .chat-video {
  max-width: 100%;
  border-radius: 12px;
  margin-top: 5px;
}

.input-area {
  display: flex;
  gap: 6px;
  padding: 10px;
  background: #181818;
  border-top: 1px solid #444;
}

.input-area input[type="text"] {
  border: none;
  padding: 12px;
  border-radius: 12px;
  background: #333;
  color: white;
  font-size: 15px;
  outline: none;
  flex: 1;
}

.input-area button {
  border: none;
  padding: 12px;
  border-radius: 12px;
  background: white;
  color: black;
  font-weight: bold;
}

.file-btn {
  background: #555 !important;
  color: white !important;
}
</style>
</head>

<body>

<div id="loading">
  <div class="lightning">⚡</div>
  <div class="logo">Z CHAT</div>
</div>

<div class="app">
  <div class="header">
    <button id="leaveBtn" class="leave-btn" onclick="leaveRoom()">나가기</button>
    ⚡ Z Chat
  </div>

  <div id="mainPage" class="page">
    <div class="card">
      <h2>관리자 화면</h2>
      <p>방을 만들거나 기존 방에 들어가세요</p>
      <button onclick="showCreateRoom()">방 만들기</button>
      <button class="sub-btn" onclick="showJoinRoom()">방 들어가기</button>
    </div>

    <div class="room-list-title">내 채팅방</div>
    <div id="myRooms"></div>
  </div>

  <div id="createPage" class="page" style="display:none;">
    <div class="card">
      <h2>방 만들기</h2>
      <input id="createCode" placeholder="방 코드 예: z9x7qk21p">
      <input id="createName" placeholder="내 이름">
      <button onclick="createRoom()">방 만들기</button>
      <button class="sub-btn" onclick="goMain()">뒤로가기</button>
    </div>
  </div>

  <div id="joinPage" class="page" style="display:none;">
    <div class="card">
      <h2>방 들어가기</h2>
      <p id="joinGuide">친구에게 받은 방 코드를 입력하세요</p>
      <input id="joinCode" placeholder="초대코드 입력">
      <input id="joinName" placeholder="내 이름">
      <button onclick="joinRoom()">입장하기</button>
      <button id="joinBackBtn" class="sub-btn" onclick="goMain()">뒤로가기</button>
    </div>
  </div>

  <div id="chatPage">
    <div class="status" id="status">접속 중...</div>
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

let userId = localStorage.getItem("z_userId");
let userName = localStorage.getItem("z_userName") || "";
let roomCode = "";
let enterTimer = null;
let messageTimer = null;

if (!userId) {
  userId = Math.random().toString(36).substring(2);
  localStorage.setItem("z_userId", userId);
}

setTimeout(() => {
  document.getElementById("loading").style.display = "none";

  document.getElementById("joinName").value = userName;
  document.getElementById("createName").value = userName;

  if (IS_ADMIN === "true") {
    goMain();
  } else {
    showJoinRoomForGuest();
  }
}, 1300);

function getSavedRooms() {
  return JSON.parse(localStorage.getItem("z_rooms") || "[]");
}

function saveRoom(code) {
  let rooms = getSavedRooms();
  if (!rooms.includes(code)) {
    rooms.unshift(code);
    localStorage.setItem("z_rooms", JSON.stringify(rooms));
  }
}

function renderMyRooms() {
  const box = document.getElementById("myRooms");
  const rooms = getSavedRooms();

  if (rooms.length === 0) {
    box.innerHTML = "<div class='room-sub'>아직 들어간 방이 없습니다.</div>";
    return;
  }

  box.innerHTML = "";

  rooms.forEach(code => {
    const div = document.createElement("div");
    div.className = "room-item";
    div.onclick = () => openSavedRoom(code);
    div.innerHTML = "<div class='room-name'>채팅방 " + escapeHtml(code) + "</div><div class='room-sub'>눌러서 다시 입장</div>";
    box.appendChild(div);
  });
}

function hideAllPages() {
  document.getElementById("mainPage").style.display = "none";
  document.getElementById("createPage").style.display = "none";
  document.getElementById("joinPage").style.display = "none";
  document.getElementById("chatPage").style.display = "none";
}

function goMain() {
  stopTimers();
  roomCode = "";
  document.getElementById("leaveBtn").style.display = "none";
  hideAllPages();
  document.getElementById("mainPage").style.display = "block";
  renderMyRooms();
}

function showCreateRoom() {
  hideAllPages();
  document.getElementById("createPage").style.display = "block";
}

function showJoinRoom() {
  hideAllPages();
  document.getElementById("joinPage").style.display = "block";
  document.getElementById("joinBackBtn").style.display = "block";
}

function showJoinRoomForGuest() {
  hideAllPages();
  document.getElementById("joinPage").style.display = "block";
  document.getElementById("joinBackBtn").style.display = "none";
  document.getElementById("joinGuide").innerText = "방 코드와 이름을 입력하세요";
}

function saveName(name) {
  userName = name;
  localStorage.setItem("z_userName", userName);
}

async function createRoom() {
  const code = document.getElementById("createCode").value.trim();
  const name = document.getElementById("createName").value.trim();

  if (!code) return alert("방 코드를 입력해줘");
  if (!name) return alert("이름을 입력해줘");

  saveName(name);
  roomCode = code;

  const res = await fetch("/create-room", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ roomCode })
  });

  const data = await res.json();
  if (!data.ok) return alert(data.message || "방 만들기 실패");

  saveRoom(roomCode);
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
    alert("없는 방 코드야. 방 만든 사람이 먼저 만들어야 해.");
    return;
  }

  saveName(name);
  roomCode = code;
  saveRoom(roomCode);
  startChat();
}

function openSavedRoom(code) {
  if (!userName) {
    const name = prompt("이름을 입력해줘");
    if (!name) return;
    saveName(name.trim());
  }

  roomCode = code;
  startChat();
}

function startChat() {
  hideAllPages();
  document.getElementById("chatPage").style.display = "flex";
  document.getElementById("leaveBtn").style.display = "block";

  enter();
  loadMessages();

  stopTimers();
  enterTimer = setInterval(enter, 3000);
  messageTimer = setInterval(loadMessages, 1000);
}

async function leaveRoom() {
  await fetch("/leave", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ userId, roomCode })
  });

  if (IS_ADMIN === "true") goMain();
  else showJoinRoomForGuest();
}

function stopTimers() {
  if (enterTimer) clearInterval(enterTimer);
  if (messageTimer) clearInterval(messageTimer);
}

async function enter() {
  if (!roomCode) return;

  const res = await fetch("/enter", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ userId, roomCode, userName })
  });

  const data = await res.json();

  if (!data.ok) {
    document.body.innerHTML = "<h1 style='text-align:center;margin-top:40vh;'>방이 꽉 찼습니다.</h1>";
    return;
  }

  document.getElementById("status").innerText =
    "방 코드: " + roomCode + " / 접속자: " + data.count + " / 6";
}

async function loadMessages() {
  if (!roomCode) return;

  const res = await fetch("/messages?room=" + encodeURIComponent(roomCode));
  const data = await res.json();

  const box = document.getElementById("messages");
  box.innerHTML = "";

  data.forEach(m => {
    const isMine = m.userId === userId;
    const wrap = document.createElement("div");
    wrap.className = "msg-wrap " + (isMine ? "mine" : "other");

    const div = document.createElement("div");
    div.className = "msg " + (isMine ? "mine" : "other");

    let content = "<div class='name'>" + escapeHtml(m.name) + "</div>";

    if (m.type === "image") {
      content += "<img class='chat-img' src='" + m.data + "'>";
    } else if (m.type === "video") {
      content += "<video class='chat-video' src='" + m.data + "' controls></video>";
    } else {
      content += escapeHtml(m.text);
    }

    div.innerHTML = content;
    wrap.appendChild(div);
    box.appendChild(wrap);
  });

  box.scrollTop = box.scrollHeight;
}

async function sendText() {
  const text = document.getElementById("text").value;
  if (!text.trim()) return;

  await fetch("/send", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
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

  if (file.size > ${MAX_UPLOAD_SIZE}) {
    alert("파일은 5MB 이하만 가능해.");
    return;
  }

  if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
    alert("사진이나 영상만 가능해.");
    return;
  }

  const reader = new FileReader();

  reader.onload = async function() {
    await fetch("/send", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
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

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("keydown", e => {
  if (e.key === "Enter" && document.getElementById("text") === document.activeElement) {
    sendText();
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js");
}
</script>
</body>
</html>
`;

const manifest = JSON.stringify({
  name: "Z Chat",
  short_name: "ZChat",
  start_url: "/",
  display: "standalone",
  background_color: "#111111",
  theme_color: "#111111",
  orientation: "portrait",
  icons: [
    {
      src: "https://via.placeholder.com/192.png?text=Z",
      sizes: "192x192",
      type: "image/png"
    },
    {
      src: "https://via.placeholder.com/512.png?text=Z",
      sizes: "512x512",
      type: "image/png"
    }
  ]
});

const serviceWorker = `
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {});
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

function sendHtml(res, isAdmin) {
  res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
  res.end(html.replace("__IS_ADMIN__", isAdmin ? "true" : "false"));
}

function readBody(req, callback) {
  let body = "";
  req.on("data", chunk => {
    body += chunk;
    if (body.length > 8 * 1024 * 1024) {
      req.destroy();
    }
  });
  req.on("end", () => callback(body));
}

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    sendHtml(res, false);
  }

  else if (req.url === "/admin") {
    sendHtml(res, true);
  }

  else if (req.url === "/manifest.json") {
    res.writeHead(200, {"Content-Type":"application/json"});
    res.end(manifest);
  }

  else if (req.url === "/service-worker.js") {
    res.writeHead(200, {"Content-Type":"application/javascript"});
    res.end(serviceWorker);
  }

  else if (req.url === "/create-room" && req.method === "POST") {
    readBody(req, body => {
      const data = JSON.parse(body);
      const code = String(data.roomCode || "").trim();

      if (!code) {
        res.writeHead(200, {"Content-Type":"application/json"});
        res.end(JSON.stringify({ ok:false, message:"방 코드가 비어있음" }));
        return;
      }

      getRoom(code);
      res.writeHead(200, {"Content-Type":"application/json"});
      res.end(JSON.stringify({ ok:true }));
    });
  }

  else if (req.url.startsWith("/check-room")) {
    const url = new URL(req.url, "http://localhost");
    const roomCode = url.searchParams.get("room");

    res.writeHead(200, {"Content-Type":"application/json"});
    res.end(JSON.stringify({ exists: !!rooms[roomCode] }));
  }

  else if (req.url === "/enter" && req.method === "POST") {
    readBody(req, body => {
      const data = JSON.parse(body);
      const room = getRoom(data.roomCode);
      const now = Date.now();

      for (const [id, info] of room.users) {
        if (now - info.time > 10000) room.users.delete(id);
      }

      if (!room.users.has(data.userId) && room.users.size >= MAX_USERS_PER_ROOM) {
        res.writeHead(200, {"Content-Type":"application/json"});
        res.end(JSON.stringify({ ok:false, count:room.users.size }));
        return;
      }

      room.users.set(data.userId, {
        name: data.userName || "익명",
        time: now
      });

      res.writeHead(200, {"Content-Type":"application/json"});
      res.end(JSON.stringify({ ok:true, count:room.users.size }));
    });
  }

  else if (req.url === "/leave" && req.method === "POST") {
    readBody(req, body => {
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

    res.writeHead(200, {"Content-Type":"application/json; charset=utf-8"});
    res.end(JSON.stringify(room.messages));
  }

  else if (req.url === "/send" && req.method === "POST") {
    readBody(req, body => {
      const data = JSON.parse(body);
      const room = getRoom(data.roomCode);

      if (!room.users.has(data.userId)) {
        res.writeHead(403);
        res.end("Not entered");
        return;
      }

      room.messages.push({
        userId: data.userId,
        name: data.name || "익명",
        type: data.type || "text",
        text: data.text || "",
        data: data.data || "",
        fileName: data.fileName || "",
        time: Date.now()
      });

      if (room.messages.length > 100) room.messages.shift();

      res.writeHead(200);
      res.end("OK");
    });
  }

  else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Z Chat 서버 실행됨!");
  console.log("PORT:", PORT);
});
