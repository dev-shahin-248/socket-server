// index.js

const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('send-message', async (data) => {
    // data = { sender_type: 'admin'|'user', message: 'text' }
    console.log('Received message:', data);
    // Broadcast to all except sender
    socket.broadcast.emit('receive-message', data);

    // Also emit back to sender for confirmation (optional)
    socket.emit('receive-message', data);
    
    // Store message on backend
    try {
      await axios.post('http://127.0.0.1:8000/api/store-message', data);
      console.log('Store message success:', data);
    } catch (err) {
      console.error('Store message error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Socket server running on http://localhost:3000');
});
