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

  // Join a room specific to admin and user
  socket.on('join-room', ({ adminId, userId }) => {
    const roomId = `chat_${Math.min(adminId, userId)}_${Math.max(adminId, userId)}`;
    socket.join(roomId);
    console.log(`Client ${socket.id} joined room: ${roomId}`);
  });

  socket.on('send-message', async (data) => {
    // data = { sender_id, receiver_id, sender_type: 'admin'|'user', message }
    console.log('Received message:', data);

    // Determine room ID based on sender and receiver
    const roomId = `chat_${Math.min(data.sender_id, data.receiver_id)}_${Math.max(data.sender_id, data.receiver_id)}`;

    // Broadcast to the specific room
    io.to(roomId).emit('receive-message', data);

    // Store message on backend
    try {
      await axios.post('http://127.0.0.1:8000/api/store-message', {
        sender_id: data.sender_id,
        receiver_id: data.receiver_id,
        message: data.message,
        sender_type: data.sender_type
      });
      console.log('Store message success:', data);
    } catch (err) {
      console.log('Store message error:', err.message);
      console.error('Error storing message:', err);

    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(3000, () => {
  console.log('Socket server running on http://localhost:3000');
});