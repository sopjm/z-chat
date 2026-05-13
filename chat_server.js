const http = require("http");

const PORT = process.env.PORT || 3000;
const MAX_USERS_PER_ROOM = 6;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;

let rooms = {};

const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

<title>Z Chat</title>

<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#111111">

<style>
*{
  margin:0;
  padding:0;
  box-sizing:border-box;
}

html, body{
  width:100%;
  height:100%;
  overflow:hidden;
  background:#111;
  font-family:Arial,sans-serif;
}

body{
  color:white;
}

#loading{
  position:fixed;
  inset:0;
  background:#000;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  z-index:9999;
}

.logo{
  font-size:42px;
  font-weight:900;
  letter-spacing:6px;
}

.lightning{
  font-size:80px;
  animation:flash 0.8s infinite alternate;
}

@keyframes flash{
  from{
    opacity:0.4;
    transform:scale(0.9);
  }
  to{
    opacity:1;
    transform:scale(1.15);
  }
}

.app{
  width:100%;
  height:100dvh;
  background:#2b2b2b;
  display:flex;
  flex-direction:column;
}

@media(min-width:700px){
  .app{
    max-width:460px;
    margin:auto;
  }
}

.header{
  height:62px;
  background:#181818;
  display:flex;
  align-items:center;
  justify-content:center;
  position:relative;
  border-bottom:1px solid #444;
  font-size:22px;
  font-weight:700;
}

.leave-btn{
  position:absolute;
  left:12px;
  background:#333;
  color:white;
  border:none;
  padding:9px 12px;
  border-radius:10px;
}

.page{
  flex:1;
  overflow:auto;
  padding:18px;
}

.card{
  background:#3a3a3a;
  border-radius:22px;
  padding:22px;
  text-align:center;
  margin-bottom:16px;
}

.card h2{
  margin-bottom:10px;
}

.card p{
  opacity:0.8;
  margin-bottom:16px;
}

.card input{
  width:100%;
  margin-top:10px;
  padding:15px;
  border:none;
  border-radius:14px;
  background:#1f1f1f;
  color:white;
  font-size:16px;
}

.card button{
  width:100%;
  margin-top:12px;
  padding:15px;
  border:none;
  border-radius:14px;
  background:white;
  color:black;
  font-size:16px;
  font-weight:bold;
}

.sub-btn{
  background:#555 !important;
  color:white !important;
}

.room-item{
  background:#1f1f1f;
  border:1px solid #444;
  border-radius:16px;
  padding:15px;
  margin-top:10px;
}

.room-item-title{
  font-size:18px;
  font-weight:bold;
}

.room-item-sub{
  margin-top:4px;
  font-size:13px;
  opacity:0.7;
}

#chatPage{
  display:none;
  flex-direction:column;
  flex:1;
  min-height:0;
}

.status{
  padding:9px;
  text-align:center;
  background:#333;
  font-size:13px;
}

#messages{
  flex:1;
  overflow:auto;
  padding:12px;
}

.msg-wrap{
  display:flex;
  margin:10px 0;
}

.msg-wrap.mine{
  justify-content:flex-end;
}

.msg-wrap.other{
  justify-content:flex-start;
}

.msg{
  max-width:76%;
  padding:11px 13px;
  border-radius:18px;
  word-break:break-word;
}

.msg.mine{
  background:#f7e600;
  color:black;
  border-bottom-right-radius:5px;
}

.msg.other{
  background:#444;
  color:white;
  border-bottom-left-radius:5px;
}

.name{
  font-size:12px;
  margin-bottom:5px;
  opacity:0.7;
  font-weight:bold;
}

.chat-img,
.chat-video{
  width:100%;
  border-radius:14px;
  margin-top:6px;
}

.input-area{
  display:flex;
  gap:6px;
  padding:10px;
  background:#181818;
  border-top:1px solid #444;
}

.input-area input[type="text"]{
  flex:1;
  border:none;
  border-radius:14px;
  padding:13px;
  background:#333;
  color:white;
  font-size:15px;
}

.input-area button{
  border:none;
  border-radius:14px;
  padding:13px;
  background:white;
  color:black;
  font-weight:bold;
}

.file-btn{
  background:#555 !important;
  color:white !important;
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
    <button id="leaveBtn" class="leave-btn" onclick="leaveRoom()" style="display:none;">
      나가기
    </button>

    ⚡ Z Chat
  </div>

  <div id="mainPage" class="page">

    <div class="card">
      <h2>관리자 화면</h2>
      <p>방을 만들거나 들어가세요</p>

      <button onclick="showCreateRoom()">방 만들기</button>

      <button class="sub-btn" onclick="showJoinRoom()">
        방 들어가기
      </button>
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

  <div id="chatPage">

    <div class="status" id="status">
      접속중...
    </div>

    <div id="messages"></div>

    <div class="input-area">

      <button class="file-btn"
        onclick="document.getElementById('fileInput').click()">
        ＋
      </button>

      <input
        id="fileInput"
        type="file"
        accept="image/*,video/*"
        style="display:none"
        onchange="sendFile()"
      >

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

if(!userId){
  userId = Math.random().toString(36).substring(2);
  localStorage.setItem("z_userId", userId);
}

setTimeout(()=>{

  document.getElementById("loading").style.display = "none";

  document.getElementById("joinName").value = userName;
  document.getElementById("createName").value = userName;

  if(IS_ADMIN === "true"){
    goMain();
  }else{
    showJoinRoomForGuest();
  }

},1200);

function hideAllPages(){

  document.getElementById("mainPage").style.display = "none";
  document.getElementById("createPage").style.display = "none";
  document.getElementById("joinPage").style.display = "none";
  document.getElementById("chatPage").style.display = "none";
}

function goMain(){

  hideAllPages();

  document.getElementById("mainPage").style.display = "block";

  renderRooms();

  document.getElementById("leaveBtn").style.display = "none";
}

function showCreateRoom(){

  hideAllPages();

  document.getElementById("createPage").style.display = "block";
}

function showJoinRoom(){

  hideAllPages();

  document.getElementById("joinPage").style.display = "block";
}

function showJoinRoomForGuest(){

  hideAllPages();

  document.getElementById("joinPage").style.display = "block";
}

function saveRoom(code){

  let rooms = JSON.parse(localStorage.getItem("z_rooms") || "[]");

  if(!rooms.includes(code)){
    rooms.unshift(code);
  }

  localStorage.setItem("z_rooms", JSON.stringify(rooms));
}

function renderRooms(){

  const box = document.getElementById("myRooms");

  const rooms = JSON.parse(localStorage.getItem("z_rooms") || "[]");

  box.innerHTML = "";

  rooms.forEach(code=>{

    box.innerHTML += \`
      <div class="room-item" onclick="openSavedRoom('\${code}')">
        <div class="room-item-title">\${code}</div>
        <div class="room-item-sub">다시 입장하기</div>
      </div>
    \`;
  });
}

async function createRoom(){

  const code = document.getElementById("createCode").value.trim();
  const name = document.getElementById("createName").value.trim();

  if(!code) return alert("방 코드 입력");
  if(!name) return alert("이름 입력");

  userName = name;

  localStorage.setItem("z_userName", name);

  roomCode = code;

  await fetch("/create-room",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      roomCode
    })
  });

  saveRoom(code);

  startChat();
}

async function joinRoom(){

  const code = document.getElementById("joinCode").value.trim();
  const name = document.getElementById("joinName").value.trim();

  if(!code) return alert("방 코드 입력");
  if(!name) return alert("이름 입력");

  const res = await fetch("/check-room?room="+encodeURIComponent(code));

  const data = await res.json();

  if(!data.exists){
    return alert("없는 방 코드");
  }

  userName = name;

  localStorage.setItem("z_userName", name);

  roomCode = code;

  saveRoom(code);

  startChat();
}

function openSavedRoom(code){

  roomCode = code;

  startChat();
}

async function startChat(){

  hideAllPages();

  document.getElementById("chatPage").style.display = "flex";

  document.getElementById("leaveBtn").style.display = "block";

  await enter();

  loadMessages();

  setInterval(loadMessages,1000);
}

async function leaveRoom(){

  await fetch("/leave",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      userId,
      roomCode
    })
  });

  if(IS_ADMIN === "true"){
    goMain();
  }else{
    showJoinRoomForGuest();
  }
}

async function enter(){

  const res = await fetch("/enter",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      userId,
      roomCode,
      userName
    })
  });

  const data = await res.json();

  document.getElementById("status").innerText =
    "방 코드: "+roomCode+" / 접속자: "+data.count+"/6";
}

async function loadMessages(){

  const res = await fetch("/messages?room="+encodeURIComponent(roomCode));

  const data = await res.json();

  const box = document.getElementById("messages");

  box.innerHTML = "";

  data.forEach(m=>{

    const mine = m.userId === userId;

    let content = "";

    if(m.type === "image"){

      content =
        "<img class='chat-img' src='"+m.data+"'>";

    }else if(m.type === "video"){

      content =
        "<video class='chat-video' controls src='"+m.data+"'></video>";

    }else{

      content = escapeHtml(m.text);
    }

    box.innerHTML += \`
      <div class="msg-wrap \${mine ? "mine" : "other"}">
        <div class="msg \${mine ? "mine" : "other"}">

          <div class="name">
            \${escapeHtml(m.name)}
          </div>

          \${content}

        </div>
      </div>
    \`;
  });

  box.scrollTop = box.scrollHeight;
}

async function sendText(){

  const text = document.getElementById("text").value;

  if(!text.trim()) return;

  await fetch("/send",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      userId,
      roomCode,
      name:userName,
      type:"text",
      text
    })
  });

  document.getElementById("text").value = "";

  loadMessages();
}

function sendFile(){

  const file = document.getElementById("fileInput").files[0];

  if(!file) return;

  if(file.size > ${MAX_UPLOAD_SIZE}){
    return alert("5MB 이하만 가능");
  }

  const reader = new FileReader();

  reader.onload = async ()=>{

    await fetch("/send",{
      method:"POST",
      headers:{
        "Content-Type":"application/json"
      },
      body:JSON.stringify({
        userId,
        roomCode,
        name:userName,
        type:file.type.startsWith("image/")
          ? "image"
          : "video",
        data:reader.result
      })
    });

    loadMessages();
  };

  reader.readAsDataURL(file);
}

function escapeHtml(text){

  return String(text || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

document.addEventListener("keydown",e=>{

  if(
    e.key === "Enter" &&
    document.getElementById("text") === document.activeElement
  ){
    sendText();
  }
});

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("/service-worker.js");
}

</script>

</body>
</html>
`;

const manifest = JSON.stringify({
  name:"Z Chat",
  short_name:"ZChat",
  start_url:"/",
  display:"standalone",
  background_color:"#111111",
  theme_color:"#111111",
  orientation:"portrait",
  icons:[
    {
      src:"/icon.svg",
      sizes:"192x192",
      type:"image/svg+xml"
    },
    {
      src:"/icon.svg",
      sizes:"512x512",
      type:"image/svg+xml"
    }
  ]
});

const serviceWorker = `
self.addEventListener("install",e=>{
  self.skipWaiting();
});

self.addEventListener("activate",e=>{
  self.clients.claim();
});

self.addEventListener("fetch",e=>{});
`;

function getRoom(code){

  if(!rooms[code]){

    rooms[code] = {
      messages:[],
      users:new Map()
    };
  }

  return rooms[code];
}

function readBody(req,callback){

  let body = "";

  req.on("data",chunk=>{

    body += chunk;
  });

  req.on("end",()=>{

    callback(body);
  });
}

function sendHtml(res,isAdmin){

  res.writeHead(200,{
    "Content-Type":"text/html; charset=utf-8"
  });

  res.end(
    html.replace("__IS_ADMIN__", isAdmin ? "true" : "false")
  );
}

const server = http.createServer((req,res)=>{

  if(req.url === "/"){

    sendHtml(res,false);
  }

  else if(req.url === "/admin"){

    sendHtml(res,true);
  }

  else if(req.url === "/manifest.json"){

    res.writeHead(200,{
      "Content-Type":"application/json"
    });

    res.end(manifest);
  }

  else if(req.url === "/service-worker.js"){

    res.writeHead(200,{
      "Content-Type":"application/javascript"
    });

    res.end(serviceWorker);
  }

  else if(req.url === "/icon.svg"){

    res.writeHead(200,{
      "Content-Type":"image/svg+xml"
    });

    res.end(\`
<svg xmlns="http://www.w3.org/2000/svg"
width="512"
height="512"
viewBox="0 0 512 512">

<rect
width="512"
height="512"
rx="110"
fill="#111111"/>

<text
x="50%"
y="45%"
text-anchor="middle"
font-size="170"
font-weight="900"
fill="#ffffff"
font-family="Arial">
Z
</text>

<text
x="50%"
y="66%"
text-anchor="middle"
font-size="56"
font-weight="700"
fill="#f7e600"
font-family="Arial">
CHAT
</text>

<text
x="50%"
y="83%"
text-anchor="middle"
font-size="70">
⚡
</text>

</svg>
    `);
  }

  else if(req.url === "/create-room" && req.method === "POST"){

    readBody(req,body=>{

      const data = JSON.parse(body);

      getRoom(data.roomCode);

      res.writeHead(200,{
        "Content-Type":"application/json"
      });

      res.end(JSON.stringify({
        ok:true
      }));
    });
  }

  else if(req.url.startsWith("/check-room")){

    const url = new URL(req.url,"http://localhost");

    const roomCode = url.searchParams.get("room");

    res.writeHead(200,{
      "Content-Type":"application/json"
    });

    res.end(JSON.stringify({
      exists:!!rooms[roomCode]
    }));
  }

  else if(req.url === "/enter" && req.method === "POST"){

    readBody(req,body=>{

      const data = JSON.parse(body);

      const room = getRoom(data.roomCode);

      const now = Date.now();

      for(const [id,info] of room.users){

        if(now - info.time > 10000){
          room.users.delete(id);
        }
      }

      if(
        !room.users.has(data.userId) &&
        room.users.size >= MAX_USERS_PER_ROOM
      ){

        return res.end(JSON.stringify({
          ok:false,
          count:room.users.size
        }));
      }

      room.users.set(data.userId,{
        name:data.userName,
        time:now
      });

      res.writeHead(200,{
        "Content-Type":"application/json"
      });

      res.end(JSON.stringify({
        ok:true,
        count:room.users.size
      }));
    });
  }

  else if(req.url === "/leave" && req.method === "POST"){

    readBody(req,body=>{

      const data = JSON.parse(body);

      const room = getRoom(data.roomCode);

      room.users.delete(data.userId);

      res.end("OK");
    });
  }

  else if(req.url.startsWith("/messages")){

    const url = new URL(req.url,"http://localhost");

    const roomCode = url.searchParams.get("room");

    const room = getRoom(roomCode);

    res.writeHead(200,{
      "Content-Type":"application/json"
    });

    res.end(JSON.stringify(room.messages));
  }

  else if(req.url === "/send" && req.method === "POST"){

    readBody(req,body=>{

      const data = JSON.parse(body);

      const room = getRoom(data.roomCode);

      room.messages.push({
        userId:data.userId,
        name:data.name,
        type:data.type,
        text:data.text || "",
        data:data.data || "",
        time:Date.now()
      });

      if(room.messages.length > 100){
        room.messages.shift();
      }

      res.end("OK");
    });
  }

  else{

    res.writeHead(404);

    res.end("Not Found");
  }
});

server.listen(PORT,"0.0.0.0",()=>{

  console.log("Z Chat 서버 실행됨!");
});
