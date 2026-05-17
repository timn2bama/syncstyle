import type { VercelRequest, VercelResponse } from '@vercel/node';

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.SITE_URL || '',
].filter(Boolean);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = (req.headers['origin'] as string) || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  res.setHeader('Access-Control-Allow-Origin', corsOrigin || '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const baseUrl = process.env.SITE_URL || 'https://syncstyle.lovable.app';
    const currentDate = new Date().toISOString();

    // Attempt to fetch published blog posts if a DB model is available
    let posts: { slug: string; updated_at: string }[] = [];
    try {
      // Dynamic import so this file doesn't break if the model doesn't exist in schema
      const { prisma } = await import('./lib/prisma');
      // @ts-ignore — model may not exist in current schema
      const dbPosts = await (prisma as any).publicBlogPost?.findMany({
        where: { published: true },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (dbPosts) {
        posts = dbPosts.map((p: any) => ({
          slug: p.slug,
          updated_at: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
        }));
      }
    } catch {
      // No blog post model available — proceed with static pages only
    }

    // Static pages with priorities and frequencies
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/about', priority: '0.8', changefreq: 'monthly' },
      { url: '/contact', priority: '0.7', changefreq: 'monthly' },
      { url: '/help', priority: '0.9', changefreq: 'weekly' },
      { url: '/blog', priority: '0.8', changefreq: 'weekly' },
      { url: '/privacy', priority: '0.5', changefreq: 'yearly' },
      { url: '/terms', priority: '0.5', changefreq: 'yearly' },
    ];

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add static pages
    staticPages.forEach((page) => {
      sitemap += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    });

    // Add blog posts
    posts.forEach((post) => {
      sitemap += `
  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <lastmod>${post.updated_at}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
    });

    sitemap += `
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(sitemap);
  } catch (error: any) {
    console.error('Error generating sitemap:', error);
    return res.status(500).send('Error generating sitemap');
  }
}
