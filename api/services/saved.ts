import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { verifyUser } from '../lib/auth';
import { logger } from '../lib/logger';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      const items = await prisma.savedService.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' },
      });
      return res.status(200).json(items);
    }

    if (req.method === 'POST') {
      const { service_name, service_address, service_phone, service_data } = req.body;
      const item = await prisma.savedService.create({
        data: {
          user_id: user.id,
          service_name,
          service_address,
          service_phone,
          service_data,
        },
      });
      return res.status(201).json(item);
    }

    if (req.method === 'PUT') {
      const { id } = req.query as { id: string };
      const { service_name, service_address, service_phone, service_data } = req.body;
      await prisma.savedService.updateMany({
        where: { id, user_id: user.id },
        data: { service_name, service_address, service_phone, service_data },
      });
      return res.status(200).json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query as { id: string };
      await prisma.savedService.deleteMany({
        where: { id, user_id: user.id },
      });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error: any) {
    logger.error('API Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
