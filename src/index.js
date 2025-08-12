const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');  // Thêm để handle cross-origin

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'https://your-netlify-site.netlify.app'],  // Thêm domain FE sau khi deploy
    methods: ['GET', 'POST']
  }
});
app.set('io', io);

app.use(cors());  // Enable CORS cho API
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