const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const axios = require("axios");
const jwt = require("jsonwebtoken");
require("dotenv").config(); 

const app = express();

// Create HTTP server using Express app
const server = http.createServer(app);
const JWT_SECRET = process.env.JWT_SECRET || "TS9ICUzn2zDGKV4fdbIDsc92yoLce8P7NxcIPVXW4RmbukpEnQRVZMBOUvj0PUNJ";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const ROOM_ACCESS_URL = `${BACKEND_URL}/api/check-room-access`;


// Pass HTTP server to Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    transports: ["websocket"]
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Socket.IO server is running"
  });
});

// JWT auth middleware for Socket.IO connections
// io.use((socket, next) => {
//   const token = socket.handshake.auth.token;
//   if (!token) {
//     return next(new Error("Authentication error: Token required"));
//   }
  
//   try {
//     const decoded = jwt.verify(token, JWT_SECRET);
   
//     socket.user = decoded; 
//     console.log("JWT verified successfully:");
//     next();
//   } catch (err) {
//     console.log("JWT verification failed:", err.message);
//     return next(new Error("Authentication error: Invalid token"));
//   }
// });
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("join-room", async ({ chatRoomId }) => {
     // const userId = socket.user.sub || socket.user.id; 

      try {
       
        // const response = await axios.post(ROOM_ACCESS_URL, {
        //   user_id: userId,
        //   chat_room_id: chatRoomId,
        // }, {
        //   headers: {
        //     Authorization: `Bearer ${socket.handshake.auth.token}`, 
        //   },
        // });
        // response.data.allowed
        if (true) {
          const roomName = `chat_room_${chatRoomId}`;
          socket.join(roomName);
          console.log(`User joined room: ${roomName}`);
        //  console.log(`User ${userId} joined room: ${roomName}`);
        } else {
          //socket.emit("error", "Access denied to this chat room");
          console.log(`User ${userId} denied access to room: ${chatRoomId}`);
        }
      } catch (err) {
        console.error("Error checking room access:", err.message);
        //socket.emit("error", "Could not verify room access");
      }
    });

  socket.on("send-message", async (data) => {
    const roomName = `chat_room_${data.chat_room_id}`;
    console.log(`Received message in ${roomName}:`, data);

    io.to(roomName).emit("receive-message", data);

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
