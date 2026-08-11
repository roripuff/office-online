const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

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
      <p style="color:#94a3b8;">Use <b>WASD</b> or <b>Arrow Keys</b> to walk around</p>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const players = {};
        const keys = {};
        let myId = null;

        function joinGame() {
          const name = document.getElementById('username').value.trim() || 'Guest';
          const color = document.getElementById('userColor').value;
          
          socket.emit('createProfile', { name, color });
          document.getElementById('profileOverlay').style.display = 'none';
        }

        socket.on('connect', () => { myId = socket.id; });
        socket.on('currentPlayers', (p) => Object.assign(players, p));
        socket.on('newPlayer', ({ id, playerInfo }) => { players[id] = playerInfo; });
        socket.on('playerMoved', ({ id, x, y }) => { if (players[id]) { players[id].x = x; players[id].y = y; } });
        socket.on('playerDisconnected', (id) => delete players[id]);

        window.addEventListener('keydown', (e) => keys[e.key] = true);
        window.addEventListener('keyup', (e) => keys[e.key] = false);

        function update() {
          let move = { x: 0, y: 0 };
          if (keys['ArrowUp'] || keys['w']) move.y -= 1;
          if (keys['ArrowDown'] || keys['s']) move.y += 1;
          if (keys['ArrowLeft'] || keys['a']) move.x -= 1;
          if (keys['ArrowRight'] || keys['d']) move.x += 1;
          if (move.x !== 0 || move.y !== 0) socket.emit('playerMovement', move);
        }

        function render() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Office Desks
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(100, 100, 120, 60);
          ctx.fillRect(580, 100, 120, 60);
          ctx.fillRect(340, 300, 120, 60);

          // Render Players
          for (let id in players) {
            const p = players[id];
            if (!p.name) continue; // Hide players who haven't finished profile setup

            ctx.beginPath();
            ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#0f172a';
            ctx.stroke();

            // Render Player Label
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 13px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText(p.name, p.x, p.y - 20);
          }
        }

        setInterval(() => { update(); render(); }, 1000 / 60);
      </script>
    </body>
    </html>
  `);
});

const players = {};

io.on('connection', (socket) => {
  players[socket.id] = {
    x: Math.floor(Math.random() * 700) + 50,
    y: Math.floor(Math.random() * 400) + 50,
    color: '#3b82f6',
    name: ''
  };

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
      players[socket.id].x += move.x * 5;
      players[socket.id].y += move.y * 5;
      io.emit('playerMoved', { id: socket.id, x: players[socket.id].x, y: players[socket.id].y });
    }
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerDisconnected', socket.id);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});