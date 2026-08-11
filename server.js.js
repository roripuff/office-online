const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Office Desks (x, y, width, height)
const DESKS = [
  { x: 100, y: 100, w: 120, h: 60 },
  { x: 580, y: 100, w: 120, h: 60 },
  { x: 340, y: 300, w: 120, h: 60 }
];

// Desk seats
const DESK_SEATS = [
  { x: 160, y: 180 },
  { x: 640, y: 180 },
  { x: 400, y: 380 }
];

// Boss State
const boss = {
  x: 400,
  y: 100,
  targetX: 400,
  targetY: 100,
  radius: 18,
  speed: 2
};

app.get('{*path}', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Online Virtual Office</title>
      <style>
        body { font-family: system-ui, sans-serif; text-align: center; background: #0f172a; color: white; margin: 0; padding: 20px; }
        #profileOverlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 10; }
        .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); width: 300px; }
        input, select, button { width: 100%; padding: 12px; margin-top: 12px; border-radius: 6px; border: 1px solid #475569; background: #0f172a; color: white; box-sizing: border-box; font-size: 16px; }
        button { background: #2563eb; font-weight: bold; cursor: pointer; border: none; margin-top: 20px; }
        button:hover { background: #1d4ed8; }
        canvas { background: #e2e8f0; border: 4px solid #334155; border-radius: 8px; margin-top: 10px; }
        
        /* Chat Input Area */
        #chatContainer { width: 800px; margin: 10px auto 0 auto; display: flex; gap: 8px; }
        #chatInput { flex: 1; margin-top: 0; background: #1e293b; color: white; border: 2px solid #334155; }
        #sendBtn { width: 100px; margin-top: 0; background: #10b981; }
        #sendBtn:hover { background: #059669; }
      </style>
    </head>
    <body>

      <div id="profileOverlay">
        <div class="card">
          <h2>Create Your Character</h2>
          <input type="text" id="username" placeholder="Enter your name..." maxlength="12" required />
          <label style="display:block; text-align:left; margin-top:12px; font-size:14px; color:#94a3b8;">Avatar Color:</label>
          <input type="color" id="userColor" value="#2563eb" style="height:45px; cursor:pointer;" />
          <button onclick="joinGame()">Enter Office</button>
        </div>
      </div>

      <h2>Virtual Office Floor</h2>
      <canvas id="gameCanvas" width="800" height="500"></canvas>
      
      <!-- Chat Bar -->
      <div id="chatContainer">
        <input type="text" id="chatInput" placeholder="Press Enter to send a chat bubble..." maxlength="35" autocomplete="off" />
        <button id="sendBtn" onclick="sendChat()">Send</button>
      </div>

      <p style="color:#94a3b8; font-size: 14px;">Use <b>WASD</b> or <b>Arrow Keys</b> to walk around. Avoid the <b>Red Boss</b>!</p>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const players = {};
        let keys = {};
        let bossState = { x: 400, y: 100 };
        let pulseTimer = 0;

        const desks = ${JSON.stringify(DESKS)};

        function joinGame() {
          const name = document.getElementById('username').value.trim() || 'Guest';
          const color = document.getElementById('userColor').value;
          socket.emit('createProfile', { name, color });
          document.getElementById('profileOverlay').style.display = 'none';
        }

        // Send Chat and unfocus input box
        function sendChat() {
          const input = document.getElementById('chatInput');
          const message = input.value.trim();
          if (message) {
            socket.emit('sendChatMessage', message);
            input.value = '';
          }
          input.blur(); // Automatically remove focus so controls work instantly!
          keys = {};   // Reset key states
        }

        const chatInput = document.getElementById('chatInput');

        // Clear active key movements when clicking into the chat input
        chatInput.addEventListener('focus', () => {
          keys = {};
        });

        // Allow pressing 'Enter' key to send chat
        chatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            sendChat();
          }
        });

        socket.on('currentPlayers', (p) => Object.assign(players, p));
        socket.on('newPlayer', ({ id, playerInfo }) => { players[id] = playerInfo; });
        socket.on('playerMoved', ({ id, x, y }) => { if (players[id]) { players[id].x = x; players[id].y = y; } });
        socket.on('playerDisconnected', (id) => delete players[id]);
        socket.on('bossUpdate', (data) => { bossState = data; });

        // Handle receiving chat messages
        socket.on('chatMessage', ({ id, message }) => {
          if (players[id]) {
            players[id].chatMessage = message;
            players[id].chatTimer = Date.now() + 5000;
          }
        });

        window.addEventListener('keydown', (e) => {
          if (document.activeElement === chatInput) return;
          keys[e.key] = true;
        });

        window.addEventListener('keyup', (e) => {
          if (document.activeElement === chatInput) return;
          keys[e.key] = false;
        });

        function update() {
          let move = { x: 0, y: 0 };
          if (keys['ArrowUp'] || keys['w']) move.y -= 1;
          if (keys['ArrowDown'] || keys['s']) move.y += 1;
          if (keys['ArrowLeft'] || keys['a']) move.x -= 1;
          if (keys['ArrowRight'] || keys['d']) move.x += 1;
          if (move.x !== 0 || move.y !== 0) socket.emit('playerMovement', move);
        }

        function drawSpeechBubble(x, y, text) {
          ctx.font = '12px system-ui';
          const textWidth = ctx.measureText(text).width;
          const padding = 8;
          const bubbleWidth = textWidth + (padding * 2);
          const bubbleHeight = 24;
          const bubbleX = x - (bubbleWidth / 2);
          const bubbleY = y - 50;

          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bubbleX, bubbleY, bubbleWidth, bubbleHeight, 6);
          ctx.fill();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x - 5, bubbleY + bubbleHeight);
          ctx.lineTo(x, bubbleY + bubbleHeight + 6);
          ctx.lineTo(x + 5, bubbleY + bubbleHeight);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          ctx.fillStyle = '#0f172a';
          ctx.textAlign = 'center';
          ctx.fillText(text, x, bubbleY + 16);
        }

        function render() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          pulseTimer += 0.08;
          
          // Draw Desks
          ctx.fillStyle = '#64748b';
          desks.forEach(d => {
            ctx.fillRect(d.x, d.y, d.w, d.h);
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 3;
            ctx.strokeRect(d.x, d.y, d.w, d.h);
          });

          // Draw Boss
          const pulseRadius = 18 + Math.sin(pulseTimer) * 4;
          ctx.beginPath();
          ctx.arc(bossState.x, bossState.y, pulseRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#ef4444';
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#991b1b';
          ctx.stroke();

          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 14px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText('BOSS 😡', bossState.x, bossState.y - 25);

          // Draw Players & Speech Bubbles
          const now = Date.now();
          for (let id in players) {
            const p = players[id];
            if (!p.name) continue;

            ctx.beginPath();
            ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#0f172a';
            ctx.stroke();

            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 13px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, p.x, p.y - 20);

            if (p.chatMessage && p.chatTimer > now) {
              drawSpeechBubble(p.x, p.y, p.chatMessage);
            }
          }
        }

        setInterval(() => { update(); render(); }, 1000 / 60);
      </script>
    </body>
    </html>
  `);
});

const players = {};

function checkDeskCollision(x, y, radius = 14) {
  if (x - radius < 0 || x + radius > 800 || y - radius < 0 || y + radius > 500) {
    return true;
  }
  for (let d of DESKS) {
    let closestX = Math.max(d.x, Math.min(x, d.x + d.w));
    let closestY = Math.max(d.y, Math.min(y, d.y + d.h));
    let distanceX = x - closestX;
    let distanceY = y - closestY;
    if ((distanceX * distanceX + distanceY * distanceY) < (radius * radius)) {
      return true;
    }
  }
  return false;
}

// Boss AI Loop
setInterval(() => {
  const distToTarget = Math.hypot(boss.targetX - boss.x, boss.targetY - boss.y);
  if (distToTarget < 5) {
    boss.targetX = Math.floor(Math.random() * 700) + 50;
    boss.targetY = Math.floor(Math.random() * 400) + 50;
  }

  const angle = Math.atan2(boss.targetY - boss.y, boss.targetX - boss.x);
  const nextBossX = boss.x + Math.cos(angle) * boss.speed;
  const nextBossY = boss.y + Math.sin(angle) * boss.speed;

  if (!checkDeskCollision(nextBossX, nextBossY, boss.radius)) {
    boss.x = nextBossX;
    boss.y = nextBossY;
  } else {
    boss.targetX = Math.floor(Math.random() * 700) + 50;
    boss.targetY = Math.floor(Math.random() * 400) + 50;
  }

  for (let id in players) {
    const p = players[id];
    if (!p.name) continue;

    const distToPlayer = Math.hypot(boss.x - p.x, boss.y - p.y);
    if (distToPlayer < boss.radius + 14) {
      const randomSeat = DESK_SEATS[Math.floor(Math.random() * DESK_SEATS.length)];
      p.x = randomSeat.x;
      p.y = randomSeat.y;
      io.emit('playerMoved', { id, x: p.x, y: p.y });
    }
  }

  io.emit('bossUpdate', { x: boss.x, y: boss.y });
}, 1000 / 30);

io.on('connection', (socket) => {
  const defaultSeat = DESK_SEATS[Math.floor(Math.random() * DESK_SEATS.length)];
  players[socket.id] = { x: defaultSeat.x, y: defaultSeat.y, color: '#3b82f6', name: '' };

  socket.emit('currentPlayers', players);

  socket.on('createProfile', (data) => {
    if (players[socket.id]) {
      players[socket.id].name = data.name;
      players[socket.id].color = data.color;
      io.emit('newPlayer', { id: socket.id, playerInfo: players[socket.id] });
    }
  });

  socket.on('playerMovement', (move) => {
    if (players[socket.id] && players[socket.id].name) {
      const nextX = players[socket.id].x + move.x * 4;
      const nextY = players[socket.id].y + move.y * 4;

      if (!checkDeskCollision(nextX, nextY)) {
        players[socket.id].x = nextX;
        players[socket.id].y = nextY;
        io.emit('playerMoved', { id: socket.id, x: players[socket.id].x, y: players[socket.id].y });
      }
    }
  });

  socket.on('sendChatMessage', (message) => {
    io.emit('chatMessage', { id: socket.id, message });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
