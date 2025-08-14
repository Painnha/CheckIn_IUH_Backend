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
  : ['http://localhost:3000'];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }
});
app.set('io', io);

const corsOptions = { 
  origin: allowedOrigins,
  credentials: true
};
app.use(cors(corsOptions));  // Enable CORS cho API dựa theo env
app.options('*', cors(corsOptions)); // Xử lý preflight cho mọi route
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
  console.log('Client connected via Socket.io');
  // Các event listener sẽ thêm sau
});

// Lỗi handling cơ bản
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));