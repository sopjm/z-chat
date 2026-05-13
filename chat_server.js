const http = require("http");
const webpush = require("web-push");

const PORT = process.env.PORT || 3000;
const MAX_USERS_PER_ROOM = 6;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:test@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const rooms = {};
const pushUsers = {};
const registeredUsers = new Set();

const userIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#111111"/><text x="50%" y="43%" text-anchor="middle" font-size="170" font-weight="900" fill="#ffffff" font-family="Arial">Z</text><text x="50%" y="64%" text-anchor="middle" font-size="56" font-weight="800" fill="#f7e600" font-family="Arial">CHAT</text><text x="50%" y="82%" text-anchor="middle" font-size="70" fill="#f7e600">⚡</text></svg>';
const adminIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#111111"/><text x="50%" y="43%" text-anchor="middle" font-size="140" font-weight="900" fill="#ffffff" font-family="Arial">Z</text><text x="50%" y="64%" text-anchor="middle" font-size="56" font-weight="800" fill="#f7e600" font-family="Arial">ADMIN</text><text x="50%" y="82%" text-anchor="middle" font-size="70" fill="#f7e600">👑</text></svg>';

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

const serviceWorker = String.raw`
self.addEventListener("install", function(event){
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function(event){
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", function(event){
  var data = {};
  try {
    data = event.data.json();
  } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title || "Z Chat", {
      body: data.body || "새 메시지가 도착했습니다.",
      icon: data.icon || "/icon.svg",
      badge: data.icon || "/icon.svg",
      vibrate: [200,100,200],
      data: { url: data.url || "/" }
    })
  );
});

self.addEventListener("message", function(event){
  var data = event.data || {};
  if(data.type === "SHOW_NOTIFICATION"){
    self.registration.showNotification(data.title || "Z Chat", {
      body: data.body || "새 메시지가 도착했습니다.",
      icon: data.icon || "/icon.svg",
      badge: data.icon || "/icon.svg",
      vibrate: [200,100,200],
      data: { url: data.url || "/" }
    });
  }
});

self.addEventListener("notificationclick", function(event){
  event.notification.close();
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  event.waitUntil(clients.openWindow(url));
});
`;

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
<style>
*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#111;color:white;font-family:Arial,sans-serif}.app{width:100%;height:100dvh;background:#2b2b2b;display:flex;flex-direction:column}@media(min-width:700px){.app{max-width:460px;margin:auto}}@media(orientation:landscape) and (max-height:600px){.app{max-width:900px}.header{min-height:52px;font-size:18px}.page{padding:12px}.card{padding:16px}#messages{padding:10px 18px}.msg{max-width:60%}}#loading{position:fixed;inset:0;background:#000;z-index:9999;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:15px}.lightning{font-size:80px;animation:flash .8s infinite alternate}.logo{font-size:42px;font-weight:900;letter-spacing:6px}@keyframes flash{from{opacity:.35;transform:scale(.9)}to{opacity:1;transform:scale(1.15)}}.header{min-height:62px;background:#181818;display:flex;align-items:center;justify-content:center;position:relative;border-bottom:1px solid #444;font-size:22px;font-weight:700;padding:0 112px}.leave-btn{position:absolute;left:8px;background:#333;color:white;border:none;padding:9px 10px;border-radius:10px}.people-btn{position:absolute;right:60px;background:#333;color:white;border:none;padding:9px 10px;border-radius:10px}.settings-btn{position:absolute;right:8px;background:#333;color:white;border:none;padding:9px 10px;border-radius:10px}.page{flex:1;overflow-y:auto;padding:18px}.card{background:#3a3a3a;border-radius:22px;padding:22px;text-align:center;margin-bottom:16px}.card h2{margin-bottom:10px}.card p{opacity:.8;margin-bottom:16px}.card input{width:100%;margin-top:10px;padding:15px;border:none;border-radius:14px;background:#1f1f1f;color:white;font-size:16px;outline:none}.card button{width:100%;margin-top:12px;padding:15px;border:none;border-radius:14px;background:white;color:black;font-size:16px;font-weight:bold}.sub-btn{background:#555!important;color:white!important}.room-item{background:#1f1f1f;border:1px solid #444;border-radius:16px;padding:15px;margin-top:10px}.room-item-title{font-size:18px;font-weight:bold}.room-item-sub{margin-top:4px;font-size:13px;opacity:.7}#chatPage{display:none;flex-direction:column;flex:1;min-height:0}.status{padding:9px;text-align:center;background:#333;font-size:13px}#messages{flex:1;overflow-y:auto;padding:12px}.msg-wrap{display:flex;margin:10px 0}.msg-wrap.mine{justify-content:flex-end}.msg-wrap.other{justify-content:flex-start}.msg{max-width:76%;padding:11px 13px;border-radius:18px;word-break:break-word}.msg.mine{background:#f7e600;color:black;border-bottom-right-radius:5px}.msg.other{background:#444;color:white;border-bottom-left-radius:5px}.name{font-size:12px;margin-bottom:5px;opacity:.7;font-weight:bold}.read-info{font-size:11px;opacity:.65;margin-top:4px;text-align:right}.chat-img,.chat-video{width:100%;border-radius:14px;margin-top:6px}.input-area{display:flex;gap:6px;padding:10px;background:#181818;border-top:1px solid #444;position:relative}.input-area input[type="text"]{flex:1;border:none;border-radius:14px;padding:13px;background:#333;color:white;font-size:15px;outline:none;min-width:0}.input-area button{border:none;border-radius:14px;padding:13px;background:white;color:black;font-weight:bold}.file-btn,.emoji-btn{background:#555!important;color:white!important}.emoji-panel{position:absolute;left:54px;bottom:62px;background:#1f1f1f;border:1px solid #555;border-radius:16px;padding:10px;display:none;grid-template-columns:repeat(5,36px);gap:6px;z-index:20}.emoji-panel button{background:#333;color:white;width:36px;height:36px;padding:0;font-size:20px}.toggle-row{display:flex;justify-content:space-between;align-items:center;background:#1f1f1f;padding:14px;border-radius:14px;margin-top:10px;text-align:left}.toggle-row button{width:auto;margin:0;padding:10px 14px}.small-note{color:#bbb;font-size:13px;line-height:1.5;margin-top:12px;text-align:left}.user-row{background:#1f1f1f;border:1px solid #444;border-radius:14px;padding:13px;margin-top:9px;text-align:left}.online-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#70ff70;margin-right:8px}
</style></head><body><div id="loading"><div class="lightning">⚡</div><div class="logo">__LOGO__</div></div><div class="app"><div class="header"><button id="leaveBtn" class="leave-btn" type="button" onclick="leaveRoom()" style="display:none">나가기</button><span>__HEADER__</span><button id="peopleBtn" class="people-btn" type="button" onclick="showPeople()" style="display:none">사람</button><button id="settingsBtn" class="settings-btn" type="button" onclick="showSettings()">설정</button></div><div id="mainPage" class="page"><div class="card"><h2>관리자 화면</h2><p>방을 만들거나 들어가세요</p><button onclick="showCreateRoom()">방 만들기</button><button class="sub-btn" onclick="showJoinRoom()">방 들어가기</button></div><div class="card" id="adminStatsBox"><h2>관리자 통계</h2><p id="totalUsersText">전체 접속자: 0명</p><div id="roomStats"></div></div><div id="myRooms"></div></div><div id="createPage" class="page" style="display:none"><div class="card"><h2>방 만들기</h2><input id="createCode" placeholder="방 코드"><input id="createName" placeholder="내 이름"><button onclick="createRoom()">방 만들기</button><button class="sub-btn" onclick="goMain()">뒤로가기</button></div></div><div id="joinPage" class="page" style="display:none"><div class="card"><h2>방 들어가기</h2><input id="joinCode" placeholder="방 코드"><input id="joinName" placeholder="내 이름"><button onclick="joinRoom()">입장하기</button></div><div id="guestSavedRooms"></div></div><div id="peoplePage" class="page" style="display:none"><div class="card"><h2>참여자 목록</h2><p id="peopleCount">현재 방 인원</p><div id="peopleList"></div><button class="sub-btn" onclick="backToChat()">채팅으로 돌아가기</button></div></div><div id="settingsPage" class="page" style="display:none"><div class="card"><h2>알림 설정</h2><div class="toggle-row"><span>새 메시지 알림</span><button id="notiToggle" onclick="toggleNotifications()">확인중</button></div><div class="toggle-row"><span>알림 소리</span><button id="soundToggle" onclick="toggleSound()">확인중</button></div><button class="sub-btn" onclick="backFromSettings()">돌아가기</button><div class="small-note">알림 허용 후에는 앱이 완전히 꺼져 있어도 Web Push 알림을 받을 수 있습니다.<br>단, 브라우저/기기 설정에서 알림이 차단되어 있으면 오지 않습니다.</div></div></div><div id="chatPage"><div class="status" id="status">접속중...</div><div id="messages"></div><div class="input-area"><button class="file-btn" type="button" onclick="document.getElementById('fileInput').click()">＋</button><button class="emoji-btn" type="button" onclick="toggleEmojiPanel()">😊</button><div id="emojiPanel" class="emoji-panel"></div><input id="fileInput" type="file" accept="image/*,video/*" style="display:none" onchange="sendFile()"><input id="text" type="text" placeholder="메시지 입력"><button type="button" onclick="sendText()">전송</button></div></div></div>
<script>
window.addEventListener("load", function(){
  setTimeout(function(){
    var loading = document.getElementById("loading");
    if(loading){
      loading.style.opacity = "0";
      setTimeout(function(){ loading.style.display = "none"; }, 300);
    }
  }, 1200);
});
window.onerror = function(message, source, lineno){
  var loading = document.getElementById("loading");
  if(loading){ loading.style.display = "none"; }
  alert("앱 오류: " + message + " / 줄: " + lineno);
};
</script>
<script>
const IS_ADMIN="__IS_ADMIN__";const MAX_UPLOAD_SIZE_CLIENT=__MAX_UPLOAD_SIZE__;const VAPID_PUBLIC_KEY="__VAPID_PUBLIC_KEY__";var userId=localStorage.getItem("z_userId");var userName=localStorage.getItem("z_userName")||"";var roomCode="";var messageTimer=null;var enterTimer=null;var adminTimer=null;var peopleTimer=null;var lastMessageIds=new Set();var firstMessageLoad=true;var notificationsEnabled=localStorage.getItem("z_notifications")==="true";var soundEnabled=localStorage.getItem("z_sound")!=="false";var emojis=["😀","😂","😭","❤️","👍","🥺","🎉","😎","🔥","🙏","😡","😱","🤔","💕","ㅋㅋ"];if(!userId){userId=Math.random().toString(36).substring(2);localStorage.setItem("z_userId",userId)}setTimeout(function(){document.getElementById("loading").style.display="none";document.getElementById("joinName").value=userName;document.getElementById("createName").value=userName;setupEmojiPanel();updateSettingsButtons();if(IS_ADMIN==="true")goMain();else showJoinRoomForGuest();if(notificationsEnabled)subscribePush()},1200);function hideAllPages(){document.getElementById("mainPage").style.display="none";document.getElementById("createPage").style.display="none";document.getElementById("joinPage").style.display="none";document.getElementById("settingsPage").style.display="none";document.getElementById("chatPage").style.display="none";document.getElementById("peoplePage").style.display="none"}function stopTimers(){if(messageTimer)clearInterval(messageTimer);if(enterTimer)clearInterval(enterTimer);if(adminTimer)clearInterval(adminTimer);if(peopleTimer)clearInterval(peopleTimer)}function goMain(){stopTimers();hideAllPages();document.getElementById("mainPage").style.display="block";document.getElementById("leaveBtn").style.display="none";document.getElementById("peopleBtn").style.display="none";renderRooms();loadAdminStats();adminTimer=setInterval(loadAdminStats,3000)}function showCreateRoom(){hideAllPages();document.getElementById("createPage").style.display="block"}function showJoinRoom(){hideAllPages();document.getElementById("joinPage").style.display="block";renderGuestSavedRooms()}function showJoinRoomForGuest(){hideAllPages();document.getElementById("joinPage").style.display="block";document.getElementById("leaveBtn").style.display="none";document.getElementById("peopleBtn").style.display="none";renderGuestSavedRooms()}function showSettings(){hideAllPages();document.getElementById("settingsPage").style.display="block"}function backFromSettings(){if(roomCode){backToChat();return}if(IS_ADMIN==="true")goMain();else showJoinRoomForGuest()}function backToChat(){hideAllPages();document.getElementById("chatPage").style.display="flex";document.getElementById("leaveBtn").style.display="block";document.getElementById("peopleBtn").style.display="block"}async function showPeople(){if(!roomCode)return;hideAllPages();document.getElementById("peoplePage").style.display="block";document.getElementById("leaveBtn").style.display="block";document.getElementById("peopleBtn").style.display="block";await loadPeople();if(peopleTimer)clearInterval(peopleTimer);peopleTimer=setInterval(loadPeople,3000)}async function loadPeople(){if(!roomCode)return;var res=await fetch("/room-users?room="+encodeURIComponent(roomCode));var data=await res.json();document.getElementById("peopleCount").innerText="현재 "+data.count+"명 참여 중";var box=document.getElementById("peopleList");box.innerHTML="";data.users.forEach(function(u){box.innerHTML+="<div class='user-row'><span class='online-dot'></span>"+escapeHtml(u.name)+(u.userId===userId?" (나)":"")+"</div>"})}function updateSettingsButtons(){var n=document.getElementById("notiToggle");var s=document.getElementById("soundToggle");if(n)n.innerText=notificationsEnabled?"켜짐":"꺼짐";if(s)s.innerText=soundEnabled?"켜짐":"꺼짐"}async function toggleNotifications(){if(!notificationsEnabled){if(!("Notification" in window)){alert("이 브라우저는 알림을 지원하지 않아.");return}var p=await Notification.requestPermission();if(p!=="granted"){alert("알림 권한이 허용되지 않았어.");return}notificationsEnabled=true;localStorage.setItem("z_notifications","true");await subscribePush()}else{notificationsEnabled=false;localStorage.setItem("z_notifications","false")}updateSettingsButtons()}function toggleSound(){soundEnabled=!soundEnabled;localStorage.setItem("z_sound",String(soundEnabled));updateSettingsButtons();if(soundEnabled)playBeep()}async function subscribePush(){try{if(!VAPID_PUBLIC_KEY)return;if(!("serviceWorker" in navigator))return;if(!("PushManager" in window))return;if(Notification.permission!=="granted")return;var reg=await navigator.serviceWorker.ready;var sub=await reg.pushManager.getSubscription();if(!sub){sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)})}await fetch("/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:userId,roomCode:roomCode,subscription:sub})})}catch(e){console.log("push subscribe error",e)}}function urlBase64ToUint8Array(base64String){var padding="=".repeat((4-base64String.length%4)%4);var base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");var rawData=window.atob(base64);var outputArray=new Uint8Array(rawData.length);for(var i=0;i<rawData.length;i++){outputArray[i]=rawData.charCodeAt(i)}return outputArray}function getSavedRooms(){return JSON.parse(localStorage.getItem("z_rooms")||"[]")}function saveRoom(code){var savedRooms=getSavedRooms();if(!savedRooms.includes(code))savedRooms.unshift(code);localStorage.setItem("z_rooms",JSON.stringify(savedRooms))}function renderGuestSavedRooms(){var box=document.getElementById("guestSavedRooms");if(!box)return;var savedRooms=getSavedRooms();box.innerHTML="";if(savedRooms.length===0||!userName)return;box.innerHTML="<div class='room-item-sub' style='margin:10px 0;'>전에 들어간 방</div>";savedRooms.forEach(function(code){box.innerHTML+="<div class='room-item' onclick=\"openSavedRoom('"+escapeAttr(code)+"')\"><div class='room-item-title'>"+escapeHtml(code)+"</div><div class='room-item-sub'>코드/이름 없이 바로 입장</div></div>"})}function renderRooms(){var box=document.getElementById("myRooms");var savedRooms=getSavedRooms();box.innerHTML="";if(savedRooms.length===0){box.innerHTML="<div class='room-item'><div class='room-item-sub'>아직 저장된 방이 없습니다.</div></div>";return}savedRooms.forEach(function(code){box.innerHTML+="<div class='room-item' onclick=\"openSavedRoom('"+escapeAttr(code)+"')\"><div class='room-item-title'>"+escapeHtml(code)+"</div><div class='room-item-sub'>다시 입장하기</div></div>"})}async function loadAdminStats(){if(IS_ADMIN!=="true")return;var res=await fetch("/admin-stats");var data=await res.json();document.getElementById("totalUsersText").innerText="전체 접속자: "+data.totalUsers+"명 / 총 가입자: "+data.registeredUsers+"명";var box=document.getElementById("roomStats");box.innerHTML="";if(data.rooms.length===0){box.innerHTML="<div class='room-item-sub'>아직 생성된 방이 없습니다.</div>";return}data.rooms.forEach(function(room){box.innerHTML+="<div class='room-item' onclick=\"openSavedRoom('"+escapeAttr(room.code)+"')\"><div class='room-item-title'>방 코드: "+escapeHtml(room.code)+"</div><div class='room-item-sub'>접속자 "+room.users+"명 / 메시지 "+room.messages+"개</div></div>"})}async function createRoom(){var code=document.getElementById("createCode").value.trim();var name=document.getElementById("createName").value.trim();if(!code)return alert("방 코드를 입력해줘");if(!name)return alert("이름을 입력해줘");userName=name;localStorage.setItem("z_userName",name);roomCode=code;await fetch("/create-room",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({roomCode:roomCode})});saveRoom(code);startChat()}async function joinRoom(){var code=document.getElementById("joinCode").value.trim();var name=document.getElementById("joinName").value.trim();if(!code)return alert("방 코드를 입력해줘");if(!name)return alert("이름을 입력해줘");var res=await fetch("/check-room?room="+encodeURIComponent(code));var data=await res.json();if(!data.exists)return alert("없는 방 코드야. 방 만든 사람이 먼저 만들어야 해.");userName=name;localStorage.setItem("z_userName",name);roomCode=code;saveRoom(code);startChat()}function openSavedRoom(code){if(!userName){var name=prompt("이름을 입력해줘");if(!name)return;userName=name;localStorage.setItem("z_userName",name)}roomCode=code;saveRoom(code);startChat()}async function startChat(){stopTimers();firstMessageLoad=true;lastMessageIds=new Set();hideAllPages();document.getElementById("chatPage").style.display="flex";document.getElementById("leaveBtn").style.display="block";document.getElementById("peopleBtn").style.display="block";await enter();await subscribePush();await loadMessages();enterTimer=setInterval(enter,3000);messageTimer=setInterval(loadMessages,1000)}async function leaveRoom(){try{await fetch("/leave",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:userId,roomCode:roomCode})})}catch(e){}roomCode="";stopTimers();if(IS_ADMIN==="true")goMain();else showJoinRoomForGuest()}async function enter(){if(!roomCode)return;var res=await fetch("/enter",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:userId,roomCode:roomCode,userName:userName})});var data=await res.json();if(!data.ok){document.getElementById("status").innerText="방이 꽉 찼습니다.";return}document.getElementById("status").innerText="방 코드: "+roomCode+" / 접속자: "+data.count+"/6"}async function loadMessages(){if(!roomCode)return;var res=await fetch("/messages?room="+encodeURIComponent(roomCode)+"&userId="+encodeURIComponent(userId)+"&userName="+encodeURIComponent(userName));var data=await res.json();var box=document.getElementById("messages");box.innerHTML="";var newOtherMessages=[];data.forEach(function(m){var mine=m.userId===userId;var msgId=String(m.time)+"_"+String(m.userId)+"_"+String(m.text||m.fileName||"");if(!firstMessageLoad&&!lastMessageIds.has(msgId)&&!mine)newOtherMessages.push(m);lastMessageIds.add(msgId);var content="";if(m.type==="image")content="<img class='chat-img' src='"+m.data+"'>";else if(m.type==="video")content="<video class='chat-video' controls src='"+m.data+"'></video>";else content=escapeHtml(m.text);var readInfo="";if(m.userId===userId){var count=m.readCount||0;if(IS_ADMIN==="true"&&m.readNames&&m.readNames.length>0){readInfo="<div class='read-info'>읽음 "+count+" · "+escapeHtml(m.readNames.join(", "))+"</div>"}else if(count>0){readInfo="<div class='read-info'>읽음 "+count+"</div>"}}box.innerHTML+="<div class='msg-wrap "+(mine?"mine":"other")+"'><div class='msg "+(mine?"mine":"other")+"'><div class='name'>"+escapeHtml(m.name)+"</div>"+content+readInfo+"</div></div>"});if(newOtherMessages.length>0)notifyNewMessage(newOtherMessages[newOtherMessages.length-1]);firstMessageLoad=false;box.scrollTop=box.scrollHeight}async function sendText(){var text=document.getElementById("text").value;if(!text.trim())return;await fetch("/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:userId,roomCode:roomCode,name:userName,type:"text",text:text})});document.getElementById("text").value="";loadMessages()}async function sendEmoji(emoji){await fetch("/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:userId,roomCode:roomCode,name:userName,type:"text",text:emoji})});document.getElementById("emojiPanel").style.display="none";loadMessages()}function setupEmojiPanel(){var box=document.getElementById("emojiPanel");if(!box)return;box.innerHTML="";emojis.forEach(function(e){box.innerHTML+="<button type='button' onclick=\"sendEmoji('"+escapeAttr(e)+"')\">"+escapeHtml(e)+"</button>"})}function toggleEmojiPanel(){var box=document.getElementById("emojiPanel");box.style.display=box.style.display==="grid"?"none":"grid"}function sendFile(){var file=document.getElementById("fileInput").files[0];if(!file)return;if(file.size>MAX_UPLOAD_SIZE_CLIENT)return alert("5MB 이하만 가능");if(!file.type.startsWith("image/")&&!file.type.startsWith("video/"))return alert("사진이나 영상만 가능해");var reader=new FileReader();reader.onload=async function(){await fetch("/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:userId,roomCode:roomCode,name:userName,type:file.type.startsWith("image/")?"image":"video",data:reader.result,fileName:file.name})});document.getElementById("fileInput").value="";loadMessages()};reader.readAsDataURL(file)}function notifyNewMessage(message){var body=message.type==="image"?"사진을 보냈습니다.":message.type==="video"?"영상을 보냈습니다.":message.text||"새 메시지";document.title="새 메시지! - Z Chat";setTimeout(function(){document.title=IS_ADMIN==="true"?"Z Admin":"Z Chat"},1500);if(soundEnabled)playBeep();if(navigator.vibrate)navigator.vibrate([200,100,200]);if(notificationsEnabled&&"Notification" in window&&Notification.permission==="granted"){if(navigator.serviceWorker&&navigator.serviceWorker.controller){navigator.serviceWorker.controller.postMessage({type:"SHOW_NOTIFICATION",title:message.name||"Z Chat",body:body,icon:IS_ADMIN==="true"?"/admin-icon.svg":"/icon.svg",url:location.href})}else{new Notification(message.name||"Z Chat",{body:body,icon:IS_ADMIN==="true"?"/admin-icon.svg":"/icon.svg"})}}}function playBeep(){try{var AudioContext=window.AudioContext||window.webkitAudioContext;var ctx=new AudioContext();var osc=ctx.createOscillator();var gain=ctx.createGain();osc.type="sine";osc.frequency.value=880;gain.gain.value=.08;osc.connect(gain);gain.connect(ctx.destination);osc.start();setTimeout(function(){osc.stop();ctx.close()},150)}catch(e){}}function escapeHtml(text){return String(text||"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}function escapeAttr(text){return String(text||"").replaceAll("\","\\").replaceAll("'","\'").replaceAll('"',"&quot;")}document.addEventListener("keydown",function(e){if(e.key==="Enter"&&document.getElementById("text")===document.activeElement)sendText()});if("serviceWorker" in navigator){
  navigator.serviceWorker.register("/service-worker.js").then(function(reg){
    reg.update();
    setInterval(function(){reg.update()},30000);
  });
  var refreshing=false;
  navigator.serviceWorker.addEventListener("controllerchange",function(){
    if(refreshing)return;
    refreshing=true;
    window.location.reload();
  });
}
</script></body></html>`;

function getRoom(code) {
  if (!rooms[code]) rooms[code] = { messages: [], users: new Map() };
  return rooms[code];
}

function cleanUsers(room) {
  const now = Date.now();
  for (const [id, info] of room.users) {
    if (now - info.time > 10000) room.users.delete(id);
  }
}

function readBody(req, callback) {
  let body = "";
  req.on("data", chunk => {
    body += chunk;
    if (body.length > 8 * 1024 * 1024) req.destroy();
  });
  req.on("end", () => callback(body));
}

function sendHtml(res, isAdmin) {
  const page = html
    .replaceAll("__IS_ADMIN__", isAdmin ? "true" : "false")
    .replaceAll("__TITLE__", isAdmin ? "Z Admin" : "Z Chat")
    .replaceAll("__MANIFEST__", isAdmin ? "/admin-manifest.json" : "/manifest.json")
    .replaceAll("__ICON__", isAdmin ? "/admin-icon.svg" : "/icon.svg")
    .replaceAll("__LOGO__", isAdmin ? "Z ADMIN" : "Z CHAT")
    .replaceAll("__HEADER__", isAdmin ? "👑 Z Admin" : "⚡ Z Chat")
    .replaceAll("__MAX_UPLOAD_SIZE__", String(MAX_UPLOAD_SIZE))
    .replaceAll("__VAPID_PUBLIC_KEY__", VAPID_PUBLIC_KEY);

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(page);
}

function savePushUser(userId, roomCode, subscription) {
  if (!userId || !subscription) return;
  if (!pushUsers[userId]) pushUsers[userId] = { subscription, rooms: {} };
  pushUsers[userId].subscription = subscription;
  if (roomCode) pushUsers[userId].rooms[roomCode] = true;
}

async function sendPushToRoom(roomCode, senderId, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const sendList = [];
  for (const id in pushUsers) {
    if (id === senderId) continue;
    const item = pushUsers[id];
    if (item.rooms && item.rooms[roomCode] && item.subscription) sendList.push({ id, subscription: item.subscription });
  }
  for (let i = 0; i < sendList.length; i++) {
    try {
      await webpush.sendNotification(sendList[i].subscription, JSON.stringify(payload));
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) delete pushUsers[sendList[i].id];
    }
  }
}

function decorateMessagesForClient(room, viewerId, viewerName) {
  const safeName = viewerName || "익명";
  if (viewerId) {
    room.messages.forEach(msg => {
      if (!msg.readBy) msg.readBy = {};
      if (msg.userId !== viewerId) msg.readBy[viewerId] = safeName;
    });
  }
  return room.messages.map(msg => {
    const readBy = msg.readBy || {};
    const ids = Object.keys(readBy).filter(id => id !== msg.userId);
    return Object.assign({}, msg, {
      readCount: ids.length,
      readNames: ids.map(id => readBy[id]).filter(Boolean)
    });
  });
}

const server = http.createServer(function(req, res) {
  const path = req.url.split("?")[0];

  if (path === "/") sendHtml(res, false);
  else if (path === "/z-admin" || path === "/admin") sendHtml(res, true);
  else if (path === "/manifest.json") { res.writeHead(200, {"Content-Type":"application/json"}); res.end(manifestUser); }
  else if (path === "/admin-manifest.json") { res.writeHead(200, {"Content-Type":"application/json"}); res.end(manifestAdmin); }
  else if (path === "/service-worker.js") { res.writeHead(200, {"Content-Type":"application/javascript"}); res.end(serviceWorker); }
  else if (path === "/icon.svg") { res.writeHead(200, {"Content-Type":"image/svg+xml"}); res.end(userIconSvg); }
  else if (path === "/admin-icon.svg") { res.writeHead(200, {"Content-Type":"image/svg+xml"}); res.end(adminIconSvg); }
  else if (path === "/subscribe" && req.method === "POST") {
    readBody(req, body => { const data = JSON.parse(body); savePushUser(data.userId, data.roomCode, data.subscription); res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true})); });
  }
  else if (path === "/create-room" && req.method === "POST") {
    readBody(req, body => { const data = JSON.parse(body); const code = String(data.roomCode || "").trim(); if (!code) { res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({ok:false,message:"방 코드 없음"})); return; } getRoom(code); res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true})); });
  }
  else if (path.startsWith("/check-room")) {
    const url = new URL(req.url, "http://localhost"); const roomCode = url.searchParams.get("room"); res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({exists: !!rooms[roomCode]}));
  }
  else if (path.startsWith("/room-users")) {
    const url = new URL(req.url, "http://localhost"); const roomCode = url.searchParams.get("room"); const room = getRoom(roomCode); cleanUsers(room); const users = []; for (const [id, info] of room.users) users.push({userId:id, name:info.name || "익명"}); res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({count:users.length, users}));
  }
  else if (path === "/admin-stats") {
    let totalUsers = 0; const roomList = []; for (const code in rooms) { const room = rooms[code]; cleanUsers(room); totalUsers += room.users.size; roomList.push({ code, users: room.users.size, messages: room.messages.length }); } res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({ totalUsers, registeredUsers: registeredUsers.size, rooms: roomList }));
  }
  else if (path === "/enter" && req.method === "POST") {
    readBody(req, body => { const data = JSON.parse(body); const room = getRoom(data.roomCode); cleanUsers(room); if (!room.users.has(data.userId) && room.users.size >= MAX_USERS_PER_ROOM) { res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({ok:false,count:room.users.size})); return; } room.users.set(data.userId, { name: data.userName || "익명", time: Date.now() });
      registeredUsers.add(data.userId); if (pushUsers[data.userId] && data.roomCode) pushUsers[data.userId].rooms[data.roomCode] = true; res.writeHead(200, {"Content-Type":"application/json"}); res.end(JSON.stringify({ok:true,count:room.users.size})); });
  }
  else if (path === "/leave" && req.method === "POST") {
    readBody(req, body => { const data = JSON.parse(body); const room = getRoom(data.roomCode); room.users.delete(data.userId); res.writeHead(200); res.end("OK"); });
  }
  else if (path.startsWith("/messages")) {
    const url = new URL(req.url, "http://localhost"); const roomCode = url.searchParams.get("room"); const userId = url.searchParams.get("userId"); const userName = url.searchParams.get("userName"); const room = getRoom(roomCode); const messages = decorateMessagesForClient(room, userId, userName); res.writeHead(200, {"Content-Type":"application/json; charset=utf-8"}); res.end(JSON.stringify(messages));
  }
  else if (path === "/send" && req.method === "POST") {
    readBody(req, body => { const data = JSON.parse(body); const room = getRoom(data.roomCode); const msg = { id: String(Date.now()) + "_" + Math.random().toString(36).slice(2), userId: data.userId, name: data.name || "익명", type: data.type || "text", text: data.text || "", data: data.data || "", fileName: data.fileName || "", time: Date.now(), readBy: {} }; room.messages.push(msg); if (room.messages.length > 100) room.messages.shift(); const bodyText = msg.type === "image" ? "사진을 보냈습니다." : msg.type === "video" ? "영상을 보냈습니다." : msg.text || "새 메시지"; sendPushToRoom(data.roomCode, data.userId, { title: msg.name || "Z Chat", body: bodyText, icon: "/icon.svg", url: "/" }); res.writeHead(200); res.end("OK"); });
  }
  else { res.writeHead(404); res.end("Not Found"); }
});

server.listen(PORT, "0.0.0.0", function() {
  console.log("Z Chat 서버 실행됨!");
  console.log("PORT:", PORT);
});
