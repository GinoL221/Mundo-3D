import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export default function createUpload(dest: string): any {
  const storage = multer.diskStorage({
    destination: (req: any, file: any, callback: any) => {
      callback(null, path.join(process.cwd(), 'public', 'img', dest));
    },
    filename: (req: any, file: any, callback: any) => {
      callback(null, `${uuidv4()}${path.extname(file.originalname)}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  });
}
