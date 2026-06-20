import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export default function createUpload(dest: string): any {
  const storage = multer.diskStorage({
    destination: (req: any, file: any, callback: any) => {
      const uploadPath = path.join(process.cwd(), 'public', 'img', dest);
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      callback(null, uploadPath);
    },
    filename: (req: any, file: any, callback: any) => {
      callback(null, `${uuidv4()}${path.extname(file.originalname)}`);
    },
  });

  const fileFilter = (req: any, file: any, callback: any) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return callback(null, true);
    }
    callback(new Error('Invalid file format or size limit exceeded'), false);
  };

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter,
  });
}
