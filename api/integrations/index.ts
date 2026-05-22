import type { VercelRequest, VercelResponse } from '@vercel/node';
import { prisma } from '../lib/prisma';
import { verifyUser } from '../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const user = await verifyUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  try {
    if (req.method === 'GET') {
      const integrations = await prisma.integrationSetting.findMany({
        where: { user_id: user.id },
      });
      return res.status(200).json(integrations);
    }

    if (req.method === 'POST') {
      const { integration_type, settings } = req.body;
      const integration = await prisma.integrationSetting.create({
        data: {
          user_id: user.id,
          integration_type,
          settings,
          is_active: true,
        },
      });
      return res.status(201).json(integration);
    }

    if (req.method === 'PUT') {
      const { integration_type, settings, is_active } = req.body;
      const result = await prisma.integrationSetting.updateMany({
        where: { user_id: user.id, integration_type },
        data: { settings, is_active },
      });
      return res.status(200).json(result);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id query param is required' });

      const result = await prisma.integrationSetting.deleteMany({
        where: { id: id as string, user_id: user.id },
      });
      return res.status(200).json(result);
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
