const http = require("http");

const PORT = 3000;
const MAX_USERS_PER_ROOM = 6;

let rooms = {};

const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>Z Chat</title>

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

.room-item:hover {
  background: #333;
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

.msg {
  background: #444;
  color: white;
  width: fit-content;
  max-width: 75%;
  padding: 10px 13px;
  border-radius: 16px;
  margin: 8px 0;
  line-height: 1.4;
  word-break: break-word;
}

.name {
  font-size: 12px;
  color: #ddd;
  margin-bottom: 4px;
  font-weight: bold;
}

.input-area {
  display: flex;
  gap: 6px;
  padding: 10px;
  background: #181818;
  border-top: 1px solid #444;
}

.input-area input {
  border: none;
  padding: 12px;
  border-radius: 12px;
  background: #333;
  color: white;
  font-size: 15px;
  outline: none;
}

#name { width: 85px; }
#text { flex: 1; }

.input-area button {
  border: none;
  padding: 12px;
  border-radius: 12px;
  background: white;
  color: black;
  font-weight: bold;
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
      <h2>채팅방</h2>
      <p>방을 만들거나 초대코드로 들어가세요</p>
      <button onclick="showCreateRoom()">방 만들기</button>
      <button class="sub-btn" onclick="showJoinRoom()">방 들어가기</button>
    </div>

    <div class="room-list-title">내 채팅방</div>
    <div id="myRooms"></div>
  </div>

  <div id="createPage" class="page" style="display:none;">
    <div class="card">
      <h2>방 만들기</h2>
      <input id="createCode" placeholder="예: 7777">
      <button onclick="createRoom()">방 만들기</button>
      <button class="sub-btn" onclick="goMain()">뒤로가기</button>
    </div>
  </div>

  <div id="joinPage" class="page" style="display:none;">
    <div class="card">
      <h2>방 들어가기</h2>
      <input id="joinCode" placeholder="초대코드 입력">
      <button onclick="joinRoom()">입장하기</button>
      <button class="sub-btn" onclick="goMain()">뒤로가기</button>
    </div>
  </div>

  <div id="chatPage">
    <div class="status" id="status">접속 중...</div>
    <div id="messages"></div>

    <div class="input-area">
      <input id="name" placeholder="닉네임">
      <input id="text" placeholder="메시지 입력">
      <button onclick="send()">전송</button>
    </div>
  </div>
</div>

<script>
let userId = localStorage.getItem("z_userId");
let roomCode = "";
let enterTimer = null;
let messageTimer = null;

if (!userId) {
  userId = Math.random().toString(36).substring(2);
  localStorage.setItem("z_userId", userId);
}

setTimeout(() => {
  document.getElementById("loading").style.display = "none";
  goMain();
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
}

async function createRoom() {
  const input = document.getElementById("createCode").value.trim();
  if (!input) return alert("방 코드를 입력해줘");

  roomCode = input;

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
  const input = document.getElementById("joinCode").value.trim();
  if (!input) return alert("방 코드를 입력해줘");

  const res = await fetch("/check-room?room=" + encodeURIComponent(input));
  const data = await res.json();

  if (!data.exists) {
    alert("없는 방 코드야. 방 만든 사람이 먼저 만들어야 해.");
    return;
  }

  roomCode = input;
  saveRoom(roomCode);
  startChat();
}

async function openSavedRoom(code) {
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

  goMain();
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
    body: JSON.stringify({ userId, roomCode })
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
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = "<div class='name'>" + escapeHtml(m.name) + "</div>" + escapeHtml(m.text);
    box.appendChild(div);
  });

  box.scrollTop = box.scrollHeight;
}

async function send() {
  const name = document.getElementById("name").value || "익명";
  const text = document.getElementById("text").value;

  if (!text.trim()) return;

  await fetch("/send", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ userId, roomCode, name, text })
  });

  document.getElementById("text").value = "";
  loadMessages();
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("keydown", e => {
  if (e.key === "Enter" && document.getElementById("text") === document.activeElement) {
    send();
  }
});
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

const server = http.createServer((req, res) => {
  if (req.url === "/") {
    res.writeHead(200, {"Content-Type":"text/html; charset=utf-8"});
    res.end(html);
  }

  else if (req.url === "/create-room" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
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
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const data = JSON.parse(body);
      const room = getRoom(data.roomCode);
      const now = Date.now();

      for (const [id, time] of room.users) {
        if (now - time > 10000) room.users.delete(id);
      }

      if (!room.users.has(data.userId) && room.users.size >= MAX_USERS_PER_ROOM) {
        res.writeHead(200, {"Content-Type":"application/json"});
        res.end(JSON.stringify({ ok:false, count:room.users.size }));
        return;
      }

      room.users.set(data.userId, now);

      res.writeHead(200, {"Content-Type":"application/json"});
      res.end(JSON.stringify({ ok:true, count:room.users.size }));
    });
  }

  else if (req.url === "/leave" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
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
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const data = JSON.parse(body);
      const room = getRoom(data.roomCode);

      if (!room.users.has(data.userId)) {
        res.writeHead(403);
        res.end("Not entered");
        return;
      }

      room.messages.push({
        name: data.name,
        text: data.text
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
  console.log("내 PC 접속: http://localhost:" + PORT);
});