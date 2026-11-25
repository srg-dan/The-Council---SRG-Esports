import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { createServer as createViteServer } from 'vite';

interface FirebaseConfigJson {
  apiKey: string;
}

const PORT = Number(process.env.PORT || 3000);
const MAX_COMPRESSED_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB strict server limit
const ALLOWED_MIME_TYPES = new Set(['image/webp', 'image/jpeg', 'image/png']);
const SAFE_AVATAR_FILENAME = /^[a-zA-Z0-9_\-]+\.webp$/;
const SAFE_UID_REGEX = /^[a-zA-Z0-9_\-]{1,128}$/;

const AVATARS_DIR = path.resolve(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(AVATARS_DIR, { recursive: true });

function loadFirebaseApiKey(): string {
  if (process.env.FIREBASE_API_KEY) {
    return process.env.FIREBASE_API_KEY;
  }
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  const raw = fs.readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw) as FirebaseConfigJson;
  if (!parsed.apiKey) {
    throw new Error('Missing Firebase apiKey in firebase-applet-config.json');
  }
  return parsed.apiKey;
}

const FIREBASE_API_KEY = loadFirebaseApiKey();

function detectMagicMime(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return null;
}

async function verifyFirebaseBearerToken(
  authHeader: string | undefined
): Promise<{ uid: string; emailVerified: boolean }> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authentication required.');
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken || idToken.length > 8192) {
    throw new Error('Invalid authentication token.');
  }

  const lookupRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!lookupRes.ok) {
    throw new Error('Invalid or expired session token. Please sign in again.');
  }

  const payload = (await lookupRes.json()) as {
    users?: Array<{ localId?: string; emailVerified?: boolean; disabled?: boolean }>;
  };
  const account = payload.users?.[0];
  if (!account?.localId || !SAFE_UID_REGEX.test(account.localId) || account.disabled) {
    throw new Error('Authenticated Firebase account could not be verified.');
  }

  return {
    uid: account.localId,
    emailVerified: Boolean(account.emailVerified),
  };
}

function removePreviousUserAvatars(uid: string, keepFilename?: string) {
  const prefix = `${uid}-`;
  try {
    const entries = fs.readdirSync(AVATARS_DIR);
    for (const entry of entries) {
      if (!entry.startsWith(prefix) || !entry.endsWith('.webp')) continue;
      if (keepFilename && entry === keepFilename) continue;
      const targetPath = path.resolve(AVATARS_DIR, entry);
      if (targetPath.startsWith(AVATARS_DIR + path.sep)) {
        fs.unlinkSync(targetPath);
      }
    }
  } catch (err) {
    console.warn('Could not clean up previous avatar files:', err);
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_COMPRESSED_UPLOAD_BYTES,
    files: 1,
  },
});

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'the-council-srg' });
  });

  // Serve sanitized WebP avatars safely
  app.get('/avatars/:filename', (req: Request, res: Response) => {
    const filename = String(req.params.filename || '');
    if (!SAFE_AVATAR_FILENAME.test(filename)) {
      res.status(400).json({ error: 'Invalid avatar filename.' });
      return;
    }

    const filePath = path.resolve(AVATARS_DIR, filename);
    if (!filePath.startsWith(AVATARS_DIR + path.sep) || !fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Avatar not found.' });
      return;
    }

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(filePath);
  });

  // Secure profile avatar upload endpoint:
  // 1. Verifies Firebase Bearer ID Token
  // 2. Enforces 2 MB max payload via multer
  // 3. Validates image magic bytes (JPEG, PNG, WebP only)
  // 4. Strips all EXIF metadata & re-encodes 512x512 WebP via sharp
  // 5. Saves avatars/{userId}-{timestamp}.webp & deletes previous user avatar
  app.post('/api/profile/avatar', (req: Request, res: Response, next: NextFunction) => {
    upload.single('avatar')(req, res, async (uploadErr: unknown) => {
      if (uploadErr) {
        if (uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({
            error: 'Uploaded image exceeds the 2 MB server limit. Please choose a smaller image.',
          });
          return;
        }
        res.status(400).json({ error: 'Invalid multipart upload payload.' });
        return;
      }

      try {
        const authUser = await verifyFirebaseBearerToken(req.headers.authorization);
        if (!authUser.emailVerified) {
          res.status(403).json({ error: 'Verify your email address before uploading an avatar.' });
          return;
        }

        const file = req.file;
        if (!file || !file.buffer || file.buffer.length === 0) {
          res.status(400).json({ error: 'No avatar image file provided.' });
          return;
        }

        if (file.mimetype && !ALLOWED_MIME_TYPES.has(file.mimetype)) {
          res.status(400).json({
            error: 'Unsupported file type. Only WebP, JPEG, and PNG uploads are allowed.',
          });
          return;
        }

        const detectedMime = detectMagicMime(file.buffer);
        if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
          res.status(400).json({
            error: 'Invalid image signature. Please upload a valid JPG, PNG, or WebP image.',
          });
          return;
        }

        // Re-encode to 512x512 WebP without metadata (strips EXIF / GPS / camera info)
        const meta = await sharp(file.buffer, { limitInputPixels: 4096 * 4096 }).metadata();
        if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) {
          res.status(400).json({ error: 'Unsupported or corrupted image stream.' });
          return;
        }

        const sanitizedWebp = await sharp(file.buffer, { limitInputPixels: 4096 * 4096 })
          .rotate()
          .resize(512, 512, { fit: 'cover', position: 'center' })
          .webp({ quality: 82 })
          .toBuffer();

        const nonce = crypto.randomBytes(3).toString('hex');
        const uniqueFilename = `${authUser.uid}-${Date.now()}-${nonce}.webp`;
        const destPath = path.resolve(AVATARS_DIR, uniqueFilename);

        if (!destPath.startsWith(AVATARS_DIR + path.sep)) {
          res.status(400).json({ error: 'Invalid storage destination.' });
          return;
        }

        await fs.promises.writeFile(destPath, sanitizedWebp);
        removePreviousUserAvatars(authUser.uid, uniqueFilename);

        res.status(200).json({
          avatarUrl: `/avatars/${uniqueFilename}`,
          sizeBytes: sanitizedWebp.length,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to upload avatar.';
        const status =
          message.includes('Authentication') ||
          message.includes('token') ||
          message.includes('verified')
            ? 401
            : 400;
        res.status(status).json({ error: message });
      }
    });
  });

  app.delete('/api/profile/avatar', async (req: Request, res: Response) => {
    try {
      const authUser = await verifyFirebaseBearerToken(req.headers.authorization);
      removePreviousUserAvatars(authUser.uid);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(401).json({
        error: err instanceof Error ? err.message : 'Unauthorized.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`The Council server listening on http://localhost:${PORT}`);
  });
}

startServer();
