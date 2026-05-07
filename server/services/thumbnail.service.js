const path = require('path');
const fs = require('fs');
const config = require('../config');

const thumbDir = path.join(config.mediaDir, '_thumbnails');

// Ensure thumbnail directory exists
fs.mkdirSync(thumbDir, { recursive: true });

function getVideoDuration(filePath) {
  try {
    const { execSync } = require('child_process');
    const output = execSync(
      `ffprobe -v quiet -print_format json -show_format "${filePath}"`,
      { timeout: 30000 }
    );
    const info = JSON.parse(output.toString());
    const duration = parseFloat(info.format?.duration);
    return duration && !isNaN(duration) ? Math.ceil(duration) : null;
  } catch {
    return null;
  }
}

async function generateThumbnail(filePath, mimetype) {
  const filename = path.basename(filePath);
  const thumbPath = path.join(thumbDir, filename + '.png');

  try {
    if (mimetype.startsWith('image/')) {
      // Use sharp for images
      const sharp = require('sharp');
      await sharp(filePath).resize(320, 180, { fit: 'inside' }).png().toFile(thumbPath);
      return '_thumbnails/' + filename + '.png';
    }

    if (mimetype.startsWith('video/')) {
      // Use ffmpeg for video frame extraction
      const { execSync } = require('child_process');
      execSync(
        `ffmpeg -y -i "${filePath}" -ss 00:00:01 -vframes 1 -vf scale=320:-1 "${thumbPath}"`,
        { timeout: 30000, stdio: 'ignore' }
      );
      if (fs.existsSync(thumbPath)) {
        return '_thumbnails/' + filename + '.png';
      }
    }
  } catch (err) {
    console.warn(`Thumbnail generation failed for ${filename}:`, err.message);
  }

  return null;
}

module.exports = { generateThumbnail, getVideoDuration };
