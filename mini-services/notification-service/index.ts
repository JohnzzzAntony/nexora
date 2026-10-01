import { createServer } from "http";
import { Server } from "socket.io";

const PORT = 3003;

const httpServer = createServer((_req, res) => {
  // Health check endpoint
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Notification service is running");
});

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join a room for specific user
  socket.on("join", (userId: string) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined room`);
  });

  // Leave a room
  socket.on("leave", (userId: string) => {
    socket.leave(`user:${userId}`);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// API endpoint to send notifications (called from Next.js backend)
io.of("/api").on("connection", (socket) => {
  socket.on("notify", (data: { userId: string; notification: Record<string, unknown> }) => {
    io.to(`user:${data.userId}`).emit("notification", data.notification);
  });

  socket.on("broadcast", (data: { notification: Record<string, unknown> }) => {
    io.emit("notification", data.notification);
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Notification WebSocket service running on port ${PORT}`);
});

// Keep the process alive
setInterval(() => {
  // heartbeat
}, 30000);
