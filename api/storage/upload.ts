import { put } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await requireAuth(req);

    const form = formidable({ maxFileSize: 10 * 1024 * 1024 }); // 10MB
    const [, files] = await form.parse(req);
    const file = Array.isArray(files.file) ? files.file[0] : files.file;

    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
    if (!allowedTypes.includes(file.mimetype || '')) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    const fileBuffer = fs.readFileSync(file.filepath);
    const blob = await put(
      `wardrobe/${user.id}/${Date.now()}-${file.originalFilename}`,
      fileBuffer,
      {
        access: 'public',
        contentType: file.mimetype || 'image/jpeg',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      }
    );

    return res.status(200).json({ url: blob.url });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.error('[storage/upload]', err);
    return res.status(500).json({ error: 'Upload failed' });
  }
}
