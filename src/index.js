const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');  // Thêm để handle cross-origin

dotenv.config();

const app = express();
const server = http.createServer(app);
// Cấu hình CORS từ biến môi trường: CORS_ORIGINS="http://localhost:3000,https://your-site.com"
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000'];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST']
  }
});
app.set('io', io);

app.use(cors({ origin: allowedOrigins }));  // Enable CORS cho API dựa theo env
app.use(express.json());

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes (sẽ thêm chi tiết sau)
app.use('/api/auth', require('./routes/auth.js'));  // Auth route
app.use('/api/participants', require('./routes/participants.js'));  // Generate QR, check-in, stats

// Socket.io events (sẽ dùng cho welcome và stats update)
io.on('connection', (socket) => {
  console.log('Client connected via Socket.io:', socket.id);

  // Client join vào room
  socket.on('join-room', (room) => {
    socket.join(room);
    console.log(`Client ${socket.id} joined room: ${room}`);
    
    // Gửi xác nhận join room thành công
    socket.emit('room-joined', { room, message: `Đã tham gia room ${room}` });
  });

  // Client rời khỏi room
  socket.on('leave-room', (room) => {
    socket.leave(room);
    console.log(`Client ${socket.id} left room: ${room}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Lỗi handling cơ bản
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));