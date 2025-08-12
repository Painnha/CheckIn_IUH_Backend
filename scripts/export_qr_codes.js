/*
  Export all participant QR codes from MongoDB to local PNG files.
  Output directory: packages/backend/qr_exports
  File name format: <id>_<name>.png (Windows-safe)
*/

'use strict';

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Load environment variables from backend .env
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Participant model
const Participant = require('../src/models/Participant');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'qr_exports');

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

// Windows-safe filename sanitizer
function sanitizeFileName(name) {
  // Replace Windows forbidden characters: < > : " / \ | ? * and control chars
  const forbidden = /[<>:"/\\|?*\x00-\x1F]/g;
  let safe = String(name).replace(forbidden, '_');
  // Also trim trailing dots/spaces (invalid at end of filenames on Windows)
  safe = safe.replace(/[.\s]+$/g, '');
  // Collapse multiple underscores
  safe = safe.replace(/_{2,}/g, '_');
  // Limit filename length to avoid path issues
  if (safe.length > 180) {
    safe = safe.slice(0, 180);
  }
  return safe;
}

function extractBase64FromDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    // Might be raw base64 string already
    return dataUrl;
  }
  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  // Ensure it's actually base64 per header
  if (!/;base64$/i.test(header)) {
    return null;
  }
  return base64;
}

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('Missing MONGO_URI in environment. Please set it in packages/backend/.env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  ensureOutputDir();

  const participants = await Participant.find({}, { id: 1, name: 1, qrCode: 1 }).lean();
  console.log(`Found ${participants.length} participants`);

  let successCount = 0;
  let skipCount = 0;

  for (const participant of participants) {
    try {
      const { id, name, qrCode } = participant;
      if (!qrCode || !id || !name) {
        skipCount += 1;
        continue;
      }

      const base64 = extractBase64FromDataUrl(qrCode) || qrCode;
      if (!base64) {
        skipCount += 1;
        continue;
      }

      const filename = sanitizeFileName(`${id}_${name}.png`);
      const filePath = path.join(OUTPUT_DIR, filename);
      const buffer = Buffer.from(base64, 'base64');
      fs.writeFileSync(filePath, buffer);
      successCount += 1;
    } catch (err) {
      console.error('Failed to export QR for participant:', participant && participant.id, err.message);
      skipCount += 1;
    }
  }

  await mongoose.disconnect();
  console.log(`Done. Exported ${successCount} files. Skipped ${skipCount}. Output dir: ${OUTPUT_DIR}`);
}

main().catch(async (err) => {
  console.error('Unexpected error:', err);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});


