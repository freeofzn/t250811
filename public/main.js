const socket = io();
let myId, users = {};
let OFFICE_WIDTH = 800;
let OFFICE_HEIGHT = 600;
let USER_RADIUS = 20;

const canvas = document.getElementById('office');
const ctx = canvas.getContext('2d');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');
const modal = document.getElementById('nickname-modal');
const nicknameInput = document.getElementById('nickname-input');
const nicknameOk = document.getElementById('nickname-ok');

let myNickname = "";
let keys = {};

function showModal() { modal.style.display = 'block'; nicknameInput.focus(); }
function hideModal() { modal.style.display = 'none'; }
showModal();

function sendNickname() {
  let nick = nicknameInput.value.trim();
  if (nick.length === 0) return alert("닉네임을 입력하세요!");
  if (nick.length > 12) return alert("닉네임은 12자 이내만 가능합니다.");
  myNickname = nick;
  socket.emit('join', myNickname);
  hideModal();
}

nicknameInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendNickname(); });
nicknameOk.addEventListener('click', sendNickname);

socket.on('init', (data) => {
  myId = data.id;
  users = data.users;
  OFFICE_WIDTH = data.OFFICE_WIDTH;
  OFFICE_HEIGHT = data.OFFICE_HEIGHT;
  USER_RADIUS = data.USER_RADIUS;
  draw();
});
socket.on('user-joined', ({id, user}) => {
  users[id] = user;
  draw();
  pushSysMsg(`${user.nickname} 님이 입장하셨습니다.`);
});
socket.on('user-left', (id) => {
  if (users[id]) pushSysMsg(`${users[id].nickname} 님이 퇴장하셨습니다.`);
  delete users[id];
  draw();
});
socket.on('user-moved', ({id, x, y}) => {
  if (users[id]) {
    users[id].x = x;
    users[id].y = y;
    draw();
  }
});
socket.on('chat', ({id, nickname, msg, color}) => {
  let isMe = (id === myId);
  let html = `<div style="margin-bottom:2px;">
    <b style="color:${color};">${nickname}${isMe ? " (나)" : ""}</b>:
    <span style="word-break:break-all;">${escapeHTML(msg)}</span>
  </div>`;
  chatMessages.innerHTML += html;
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

function pushSysMsg(msg) {
  chatMessages.innerHTML += `<div style="color:#8af; font-size:13px;">[알림] ${escapeHTML(msg)}</div>`;
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHTML(str) {
  return str.replace(/[&<>"]/g, tag => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'
  }[tag]));
}

// 이동 처리
document.addEventListener('keydown', e => { keys[e.key] = true; });
document.addEventListener('keyup', e => { keys[e.key] = false; });

function moveMyUser() {
  if (!myId || !users[myId]) return;
  let user = users[myId];
  let moved = false;
  let dx = 0, dy = 0;
  if (keys['ArrowUp'] || keys['w']) dy -= 1;
  if (keys['ArrowDown'] || keys['s']) dy += 1;
  if (keys['ArrowLeft'] || keys['a']) dx -= 1;
  if (keys['ArrowRight'] || keys['d']) dx += 1;
  if (dx || dy) {
    const speed = 3;
    let len = Math.sqrt(dx*dx + dy*dy);
    if (len>0) {
      let nx = user.x + (dx/len)*speed;
      let ny = user.y + (dy/len)*speed;
      nx = Math.max(USER_RADIUS, Math.min(OFFICE_WIDTH - USER_RADIUS, nx));
      ny = Math.max(USER_RADIUS, Math.min(OFFICE_HEIGHT - USER_RADIUS, ny));
      if (user.x !== nx || user.y !== ny) moved = true;
      user.x = nx;
      user.y = ny;
      socket.emit('move', {x: user.x, y: user.y});
      draw();
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // 사무실 배경
  ctx.fillStyle = "#f4f5fa";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  // 유저 그리기
  for (let id in users) {
    let u = users[id];
    // 그림자
    ctx.beginPath();
    ctx.arc(u.x, u.y + USER_RADIUS*0.7, USER_RADIUS*0.7, 0, Math.PI*2);
    ctx.fillStyle = "#0002";
    ctx.fill();
    // 원
    ctx.beginPath();
    ctx.arc(u.x, u.y, USER_RADIUS, 0, Math.PI*2);
    ctx.fillStyle = u.color;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 7;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.stroke();
    // 닉네임
    ctx.font = "15px 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#222";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeText(u.nickname, u.x, u.y-USER_RADIUS-8);
    ctx.fillText(u.nickname, u.x, u.y-USER_RADIUS-8);
  }
}

// 30 FPS 이동
setInterval(moveMyUser, 1000/30);

// 채팅
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && chatInput.value.trim()) {
    let msg = chatInput.value.slice(0,100);
    socket.emit('chat', msg);
    chatInput.value = '';
  }
};