const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const OFFICE_WIDTH = 800;
const OFFICE_HEIGHT = 600;
const USER_RADIUS = 20;

app.use(express.static(path.join(__dirname, 'public')));

const users = {};

// 유저 충돌 체크 (동그라미끼리 겹치지 않도록)
function isColliding(newX, newY, excludeId) {
  for (const id in users) {
    if (id === excludeId) continue;
    const u = users[id];
    const dx = u.x - newX;
    const dy = u.y - newY;
    if (Math.sqrt(dx*dx + dy*dy) < USER_RADIUS*2 + 2) return true;
  }
  return false;
}

io.on('connection', (socket) => {
  // 닉네임과 함께 접속
  socket.on('join', (nickname) => {
    // 랜덤 위치, 충돌 안 나게 반복
    let x, y, tries = 0;
    do {
      x = Math.random() * (OFFICE_WIDTH - USER_RADIUS*2) + USER_RADIUS;
      y = Math.random() * (OFFICE_HEIGHT - USER_RADIUS*2) + USER_RADIUS;
      tries++;
      if (tries > 50) break;
    } while(isColliding(x, y));

    users[socket.id] = {
      id: socket.id,
      nickname,
      x,
      y,
      color: '#' + Math.floor(Math.random()*16777215).toString(16),
      lastMove: Date.now()
    };
    socket.emit('init', { id: socket.id, users, OFFICE_WIDTH, OFFICE_HEIGHT, USER_RADIUS });
    socket.broadcast.emit('user-joined', { id: socket.id, user: users[socket.id] });
  });

  socket.on('move', (data) => {
    if (!users[socket.id]) return;
    // 이동 속도 제한 및 사무실 범위 체크
    let user = users[socket.id];
    const now = Date.now();
    if (now - user.lastMove < 8) return; // 간단한 rate limit
    let x = Math.max(USER_RADIUS, Math.min(OFFICE_WIDTH - USER_RADIUS, data.x));
    let y = Math.max(USER_RADIUS, Math.min(OFFICE_HEIGHT - USER_RADIUS, data.y));
    // 충돌시 이동 불가
    if (isColliding(x, y, socket.id)) return;
    user.x = x;
    user.y = y;
    user.lastMove = now;
    io.emit('user-moved', { id: socket.id, x, y });
  });

  socket.on('chat', (msg) => {
    if (users[socket.id]) {
      // 근접 채팅: 반경 120px 이내만 메시지 받음
      const sender = users[socket.id];
      for (const id in users) {
        const u = users[id];
        const dist = Math.sqrt((sender.x-u.x)**2 + (sender.y-u.y)**2);
        if (dist <= 120 || id === socket.id) {
          io.to(id).emit('chat', {
            id: socket.id,
            nickname: sender.nickname,
            msg,
            color: sender.color,
          });
        }
      }
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('user-left', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}`);
});
