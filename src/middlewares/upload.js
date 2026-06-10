const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Factory that returns a configured multer instance for image uploads.
 * @param {string} dest - Relative destination folder (e.g., 'products', 'users')
 * @returns {multer.Multer}
 */
function createUpload(dest) {
  const storage = multer.diskStorage({
    destination: (req, file, callback) => {
      callback(null, path.join(process.cwd(), 'public', 'img', dest));
    },
    filename: (req, file, callback) => {
      callback(null, `${uuidv4()}${path.extname(file.originalname)}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  });
}

module.exports = createUpload;
