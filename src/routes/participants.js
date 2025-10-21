const express = require('express');
const { v4: uuidv4 } = require('uuid');  // Để generate unique ID
const Participant = require('../models/Participant');
const { generateQR } = require('../utils/qrGenerator');
const { protect } = require('../utils/authMiddleware');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Generate QR (POST /api/participants/generate) - Admin only
router.post('/generate', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  const participants = req.body;  // Array từ upload CSV/JSON: [{id, name, organization}]
  try {
    const results = [];
    for (const p of participants) {
      const qrCode = await generateQR(p.id);  // QR chứa ID được truyền vào
      const newParticipant = new Participant({ 
        id: p.id, 
        name: p.name, 
        organization: p.organization,   
        room: p.room,
        qrCode 
      });
      await newParticipant.save();
      results.push({ 
        id: p.id, 
        name: p.name, 
        organization: p.organization,
        room: p.room,
        qrCode 
      });
    }
    res.json(results);  // Trả về để tải xuống QR
  } catch (err) {
    res.status(500).json({ message: 'Error generating QR' });
  }
});

// Check-in (POST /api/participants/checkin) - Staff/Admin
router.post('/checkin', protect, async (req, res) => {
  const { id } = req.body;  // Từ QR scan
  try {
    const participant = await Participant.findOne({ id });
    if (!participant) return res.status(404).json({ message: 'Invalid QR' });
    
    // Cho phép check-in nhiều lần
    // Nếu chưa check-in (false) thì chuyển sang true
    // Nếu đã check-in (true) thì vẫn cho phép quét lại
    participant.checkedIn = true;
    await participant.save();

    // Emit Socket.io events theo room
    const io = req.app.get('io');
    
    // Map room name sang room code cho socket
    const roomMap = {
      'Mặt trận': 'mattran',
      'Công đoàn': 'congdoan',
      'Cựu chiến binh': 'cuuchienbinh',
      'Đoàn Thanh niên': 'doantn',
      'Phụ nữ': 'phunu'
    };
    
    const roomCode = roomMap[participant.room] || participant.room;
    
    // Emit đến room cụ thể
    io.to(roomCode).emit('welcome', { 
      id: participant.id,
      name: participant.name, 
      organization: participant.organization,
      room: participant.room,
      roomCode: roomCode,
      checkedIn: participant.checkedIn,
      timestamp: new Date().toISOString(),
      message: `Chào mừng ${participant.name} (${participant.organization}) đến với đại hội!` 
    });
    
    // Emit stats update cho tất cả các room
    io.emit('stats-update');

    res.json({ 
      message: 'Check-in successful',
      participant: {
        id: participant.id,
        name: participant.name,
        organization: participant.organization,
        room: participant.room,
        roomCode: roomCode
      }
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ message: 'Check-in error' });
  }
});

// Get stats (GET /api/participants/stats) - Staff/Admin
router.get('/stats', protect, async (req, res) => {
  try {
    const total = await Participant.countDocuments();
    const checkedInParticipants = await Participant.find({ checkedIn: true });
    
    // Thống kê theo room
    const roomStats = {};
    const rooms = ['Mặt trận', 'Công đoàn', 'Cựu chiến binh', 'Đoàn Thanh niên', 'Phụ nữ'];
    
    for (const room of rooms) {
      const roomTotal = await Participant.countDocuments({ room });
      const roomCheckedIn = await Participant.countDocuments({ room, checkedIn: true });
      const roomNotCheckedIn = await Participant.find({ room, checkedIn: false }).select('id name organization room');
      
      roomStats[room] = {
        total: roomTotal,
        checkedIn: roomCheckedIn,
        notCheckedIn: roomTotal - roomCheckedIn,
        notCheckedInList: roomNotCheckedIn
      };
    }
    
    res.json({
      total,
      checkedIn: checkedInParticipants.length,
      notCheckedIn: total - checkedInParticipants.length,
      roomStats,
      checkedInParticipants: checkedInParticipants.map(p => ({
        id: p.id,
        name: p.name,
        organization: p.organization,
        room: p.room,
      })),
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ message: 'Stats error' });
  }
});

// Tìm thông tin người tham gia theo số ghế (GET /api/participants/seat/:seatNumber) - Staff/Admin
router.get('/seat/:seatNumber', protect, async (req, res) => {
  try {
    const participant = await Participant.findOne({ seatNumber: req.params.seatNumber });
    if (!participant) return res.status(404).json({ message: 'Không tìm thấy người tham gia với số ghế này' });
    res.json({
      id: participant.id,
      name: participant.name,
      organization: participant.organization,
      avatar: participant.avatar,
      seatNumber: participant.seatNumber,
      checkedIn: participant.checkedIn
    });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi tìm kiếm theo số ghế' });
  }
});

module.exports = router;
 
// Bulk operations - Admin only
// Xóa tất cả đại biểu (DELETE /api/participants/all)
router.delete('/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const result = await Participant.deleteMany({});
    const io = req.app.get('io');
    io.emit('stats-update');
    res.json({ message: 'Đã xóa tất cả đại biểu', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi xóa tất cả đại biểu' });
  }
});

// Đặt tất cả check-in = true (POST /api/participants/checkin/all/true)
router.post('/checkin/all/true', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const result = await Participant.updateMany({}, { $set: { checkedIn: true } });
    const io = req.app.get('io');
    io.emit('stats-update');
    res.json({ message: 'Đã đặt tất cả check-in = true', matchedCount: result.matchedCount ?? result.n, modifiedCount: result.modifiedCount ?? result.nModified });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi đặt tất cả check-in = true' });
  }
});

// Đặt tất cả check-in = false (POST /api/participants/checkin/all/false)
router.post('/checkin/all/false', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
    const result = await Participant.updateMany({}, { $set: { checkedIn: false } });
    const io = req.app.get('io');
    io.emit('stats-update');
    res.json({ message: 'Đã đặt tất cả check-in = false', matchedCount: result.matchedCount ?? result.n, modifiedCount: result.modifiedCount ?? result.nModified });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi khi đặt tất cả check-in = false' });
  }
});