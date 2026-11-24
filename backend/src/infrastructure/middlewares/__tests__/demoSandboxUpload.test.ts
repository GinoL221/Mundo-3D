import express from 'express';
import request from 'supertest';
import { demoProductUpload, stripDemoUploadedFile } from '../demoSandboxUpload';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/upload', demoProductUpload, stripDemoUploadedFile, (req, res) => {
    const file = (req as express.Request & { file?: unknown }).file;
    res.status(200).json({
      hasFile: file !== undefined,
      nameProduct: req.body?.nameProduct ?? null,
    });
  });
  return app;
}

describe('demoSandboxUpload middleware', () => {
  it('passes non-multipart JSON requests through untouched', async () => {
    const res = await request(buildApp()).post('/upload').send({ nameProduct: 'Busto' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ hasFile: false, nameProduct: 'Busto' });
  });

  it('validates .png and .jpg multipart uploads in memory and strips req.file before controller', async () => {
    const app = buildApp();
    const pngRes = await request(app)
      .post('/upload')
      .field('nameProduct', 'Figura PLA')
      .attach('image', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'preview.png',
        contentType: 'image/png',
      });
    expect(pngRes.status).toBe(200);
    expect(pngRes.body).toEqual({ hasFile: false, nameProduct: 'Figura PLA' });

    const jpgRes = await request(app)
      .post('/upload')
      .field('nameProduct', 'Figura JPG')
      .attach('image', Buffer.from([0xff, 0xd8, 0xff]), {
        filename: 'preview.jpg',
        contentType: 'image/jpeg',
      });
    expect(jpgRes.status).toBe(200);
    expect(jpgRes.body).toEqual({ hasFile: false, nameProduct: 'Figura JPG' });
  });

  it('rejects unsupported file extensions or MIME types with 400', async () => {
    const app = buildApp();
    const txtRes = await request(app)
      .post('/upload')
      .field('nameProduct', 'Invalida')
      .attach('image', Buffer.from('plain text'), {
        filename: 'script.txt',
        contentType: 'text/plain',
      });
    expect(txtRes.status).toBe(400);
    expect(txtRes.body.errors?.[0]?.path).toBe('image');

    const mismatchRes = await request(app)
      .post('/upload')
      .field('nameProduct', 'Spoofed')
      .attach('image', Buffer.from('<html></html>'), {
        filename: 'fake.png',
        contentType: 'text/html',
      });
    expect(mismatchRes.status).toBe(400);
  });

  it('rejects oversize uploads (> 5 MB) with 413 and Spanish error message', async () => {
    const res = await request(buildApp())
      .post('/upload')
      .field('nameProduct', 'Grande')
      .attach('image', Buffer.alloc(5 * 1024 * 1024 + 1, 0x61), {
        filename: 'oversize.png',
        contentType: 'image/png',
      });
    expect(res.status).toBe(413);
    expect(res.body.error).toMatch(/5 MB/i);
    expect(res.body.errors?.[0]).toEqual({ path: 'image', msg: res.body.error });
  });

  it('rejects multipart field floods (> 20 fields) and multiple files (> 1 file) with 413', async () => {
    const app = buildApp();
    let req = request(app).post('/upload');
    for (let i = 0; i < 21; i += 1) {
      req = req.field(`extra${i}`, 'val');
    }
    const fieldFloodRes = await req;
    expect(fieldFloodRes.status).toBe(413);

    const multiFileRes = await request(app)
      .post('/upload')
      .field('nameProduct', 'Dos Fotos')
      .attach('image', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'one.png',
        contentType: 'image/png',
      })
      .attach('image', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'two.png',
        contentType: 'image/png',
      });
    expect(multiFileRes.status).toBe(413);
  });
});
