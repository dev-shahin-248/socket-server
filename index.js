const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const axios = require("axios");

const app = express();

// Create HTTP server using Express app
const server = http.createServer(app);

// Pass HTTP server to Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Socket.IO server is running"
  });
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("join-room", ({ chatRoomId }) => {
    const roomName = `chat_room_${chatRoomId}`;
    socket.join(roomName);
    console.log(`Client ${socket.id} joined room: ${roomName}`);
  });

  socket.on("send-message", async (data) => {
    const roomName = `chat_room_${data.chat_room_id}`;
    console.log(`Received message in ${roomName}:`, data);

    io.to(roomName).emit("receive-message", data);

    try {
      await axios.post("http://127.0.0.1:8000/api/store-message", {
        chat_room_id: data.chat_room_id,
        sender_id: data.sender_id,
        message: data.message
      });

      console.log("Message stored successfully.");
    } catch (err) {
      console.error("Failed to store message:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});
