const { Server } = require("socket.io");
const axios = require("axios");

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // ✅ Join a specific chat room
  socket.on("join-room", ({ chatRoomId }) => {
    const roomName = `chat_room_${chatRoomId}`;
    socket.join(roomName);
    console.log(`Client ${socket.id} joined room: ${roomName}`);
  });

  // ✅ Handle sending message to a chat room
  socket.on("send-message", async (data) => {
    // data = { chat_room_id, sender_id, message }

    const roomName = `chat_room_${data.chat_room_id}`;
    console.log(`Received message in ${roomName}:`, data);

    // Broadcast the message to others in the room
    io.to(roomName).emit("receive-message", data);

    // Store message via Laravel API
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

  // ✅ Handle disconnect
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});
