import { createHash } from 'node:crypto';
import express, { Router } from 'express';
import sharp from 'sharp';
import { prisma } from '../db';
import { authMiddleware, verifiedMiddleware, AuthRequest } from '../middleware/auth';
import { HttpError, badRequest, handler } from '../lib/http';
import { getStorage } from '../lib/storage';

const router = Router();
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const FORMATS = new Set(['png', 'jpeg', 'webp', 'gif']);
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PER_DAY = 20;
const MAX_SIDE = 2048;

/**
 * POST /api/uploads
 * Send the image as the raw request body with its image Content-Type. The file is decoded and re-encoded
 * as WebP, which removes any metadata (such as GPS location) and rejects files that only pretend to be images.
 */
router.post('/', authMiddleware, verifiedMiddleware, express.raw({ type: ALLOWED, limit: `${MAX_BYTES}b` }), handler<AuthRequest>(async (req, res) => {
  if (!Buffer.isBuffer(req.body) || !req.body.length) {
    throw new HttpError(415, 'Send a PNG, JPEG, WebP or GIF image as the raw request body, with its image Content-Type.');
  }
  const recent = await prisma.upload.count({ where: { userId: req.userId!, createdAt: { gt: new Date(Date.now() - 86_400_000) } } });
  if (recent >= MAX_PER_DAY) throw new HttpError(429, `You can upload ${MAX_PER_DAY} images a day. Try again tomorrow.`);

  let out: { data: Buffer; info: sharp.OutputInfo };
  let frames = 1;
  try {
    const input = sharp(req.body, { animated: true, limitInputPixels: 50_000_000, failOn: 'error' });
    const meta = await input.metadata();
    if (!meta.format || !FORMATS.has(meta.format)) throw new Error('unsupported format');
    frames = meta.pages ?? 1;
    if (frames > 300) throw new Error('too many frames');
    out = await input
      .rotate()                                                   // apply EXIF orientation, then drop the EXIF
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw badRequest('That file is not a valid image.');
  }

  const sha256 = createHash('sha256').update(out.data).digest('hex');
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${sha256.slice(0, 40)}.webp`;
  const storage = getStorage();
  await storage.put(key, out.data, 'image/webp');
  const url = storage.urlFor(key);
  const upload = await prisma.upload.upsert({
    where: { storageKey: key },
    create: { userId: req.userId!, storageKey: key, url, mime: 'image/webp', bytes: out.data.length, width: out.info.width, height: Math.round(out.info.height / frames), sha256 },
    update: {},
  });
  res.status(201).json({ id: upload.id, url, width: upload.width, height: upload.height, bytes: upload.bytes });
}));

export default router;
