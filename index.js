const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
require("dotenv").config(); 

const app = express();

// Create HTTP server using Express app
const server = http.createServer(app);
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const ROOM_ACCESS_URL = `${BACKEND_URL}/api/check-room-access`;
const SECURITY_KEY = process.env.SOCKET_SECURITY_KEY || "sslwireless"; 

// Pass HTTP server to Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    transports: ["websocket"]
  }
});

// --- Logging System ---
const logDir = path.join(__dirname, "logs");

// Ensure logs directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Format for filename → y-m-d
function formatFileDate(date) {
  const pad = (n) => (n < 10 ? "0" + n : n);
  return (
    date.getFullYear() +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    pad(date.getDate())
  );
}

// Format for inside logs → d-m-y-h:i:s
function formatLogDate(date) {
  const pad = (n) => (n < 10 ? "0" + n : n);
  return (
    pad(date.getDate()) +
    "-" +
    pad(date.getMonth() + 1) +
    "-" +
    date.getFullYear() +
    "-" +
    pad(date.getHours()) +
    ":" +
    pad(date.getMinutes()) +
    ":" +
    pad(date.getSeconds())
  );
}

// Helper: write logs
function writeLog(message) {
  const date = new Date();
  const logFileName = path.join(logDir, `${formatFileDate(date)}.log`);
  const timestamp = formatLogDate(date);
  const logMessage = `[${timestamp}] ${message}\n`;

  fs.appendFile(logFileName, logMessage, (err) => {
    if (err) console.error("Error writing log:", err);
  });
}

// Default route
app.get("/", (req, res) => {
  writeLog("Socket.IO server is running");
  res.json({
    message: "Socket.IO server is running"
  });
});

// Middleware: check secretKey before allowing connection
io.use((socket, next) => {
  console.log("Checking secretKey...",socket.handshake.auth);
  const clientKey = socket.handshake.auth?.secretKey;
  if (!clientKey) {
    return next(new Error("Authentication error: secretKey required"));
  }

  if (clientKey != SECURITY_KEY) {
    writeLog(`Connection rejected: Invalid secretKey from ${socket.id}`);
    return next(new Error("Authentication error: Invalid secretKey"));
  }

  writeLog(`Connection accepted for ${socket.id} using secretKey`);
  next();
});


io.on("connection", (socket) => {
  writeLog(`Client connected: ${socket.id}`);
  console.log(`Client connected: ${socket.id}`);

  socket.on("join-room", async ({ chatRoomId }) => {
    try {
      const roomName = `chat_room_${chatRoomId}`;
      socket.join(roomName);
      writeLog(`Client ${socket.id} joined room: ${roomName}`);
      console.log(`User joined room: ${roomName}`);
    } catch (err) {
      writeLog(`Error checking room access: ${err.message}`);
      console.error("Error checking room access:", err.message);
    }
  });

  socket.on("send-message", async (data) => {
    const roomName = `chat_room_${data.chat_room_id}`;
    writeLog(`Message in ${roomName}: ${JSON.stringify(data)}`);
    console.log(`Received message in ${roomName}:`, data);

    io.to(roomName).emit("receive-message", data);
  });

  socket.on("disconnect", () => {
    writeLog(`Client disconnected: ${socket.id}`);
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
  writeLog(`Socket.IO server running on port ${PORT}`);
  console.log(`Socket.IO server running on port ${PORT}`);
});
