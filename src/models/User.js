const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },  // Nên hash trong production, nhưng tạm plain cho demo
  role: { type: String, enum: ['admin', 'staff'], default: 'staff' }
});

module.exports = mongoose.model('User', userSchema);