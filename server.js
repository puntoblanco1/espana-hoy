const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// DATABASE
// ============================================================
const DB_PATH = process.env.DB_PATH || '/data/db.json';
const DB_LOCAL = path.join(__dirname, 'db.json');

function getDB() {
  const dbFile = fs.existsSync(DB_PATH) ? DB_PATH : DB_LOCAL;
  try {
    if (fs.existsSync(dbFile)) {
      return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    }
  } catch(e) { console.error('DB read error:', e); }
  return { articles: [], pending: [], analytics: [] };
}

function saveDB(data) {
  const dbFile = fs.existsSync(path.dirname(DB_PATH)) ? DB_PATH : DB_LOCAL;
  try { fs.writeFileSync(dbFile, JSON.stringify(data, null, 2)); } 
  catch(e) { console.error('DB write error:', e); }
}

// ============================================================
// API — ARTICLES
// ============================================================

// GET /api/articles
app.get('/api/articles', (req, res) => {
  const db = getDB();
  let articles = db.articles || [];
  const { category, limit = 20, offset = 0, status, search } = req.query;

  if (status) articles = articles.filter(a => a.status === status);
  else articles = articles.filter(a => a.status === 'published' || !a.status);

  if (category && category !== 'all') {
    articles = articles.filter(a => a.category === category);
  }

  if (search) {
    const q = search.toLowerCase();
    articles = articles.filter(a =>
      (a.title||'').toLowerCase().includes(q) ||
      (a.contentAr||a.content||'').toLowerCase().includes(q)
    );
  }

  // Sort newest first
  articles.sort((a, b) => new Date(b.createdAt||b.publishedAt||0) - new Date(a.createdAt||a.publishedAt||0));

  const total = articles.length;
  const paginated = articles.slice(Number(offset), Number(offset) + Number(limit));

  res.json({ articles: paginated, total, offset: Number(offset), limit: Number(limit) });
});

// GET /api/articles/:id  (by id or slug)
app.get('/api/articles/:id', (req, res) => {
  const db = getDB();
  const articles = db.articles || [];
  const { id } = req.params;
  const article = articles.find(a => a.id === id || a.slug === id);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  res.json(article);
});

// POST /api/articles/:id/view  — increment view count
app.post('/api/articles/:id/view', (req, res) => {
  const db = getDB();
  const articles = db.articles || [];
  const idx = articles.findIndex(a => a.id === req.params.id || a.slug === req.params.id);
  if (idx !== -1) {
    articles[idx].views = (articles[idx].views || 0) + 1;
    db.articles = articles;
    saveDB(db);
  }
  res.json({ ok: true });
});

// POST /api/articles — create article (webhook from n8n)
app.post('/api/articles', (req, res) => {
  const db = getDB();
  if (!db.articles) db.articles = [];
  const article = {
    id: req.body.id || `art_${Date.now()}`,
    slug: req.body.slug || slugify(req.body.title || ''),
    title: req.body.title || '',
    summary: req.body.summary || req.body.excerpt || '',
    contentAr: req.body.contentAr || req.body.content || '',
    contentEs: req.body.contentEs || '',
    category: req.body.category || 'local-news',
    image: req.body.image || '',
    tags: req.body.tags || [],
    faq: req.body.faq || [],
    status: req.body.status || 'published',
    views: 0,
    createdAt: req.body.createdAt || new Date().toISOString(),
    publishedAt: req.body.publishedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: req.body.source || '',
    sourceUrl: req.body.sourceUrl || '',
    facebookPost: req.body.facebookPost || ''
  };

  // Avoid duplicates
  const existing = db.articles.findIndex(a => a.id === article.id || a.slug === article.slug);
  if (existing !== -1) {
    db.articles[existing] = { ...db.articles[existing], ...article, updatedAt: new Date().toISOString() };
  } else {
    db.articles.unshift(article);
  }

  saveDB(db);
  res.json({ ok: true, article });
});

// PUT /api/articles/:id — update article
app.put('/api/articles/:id', (req, res) => {
  const db = getDB();
  const idx = (db.articles||[]).findIndex(a => a.id === req.params.id || a.slug === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  db.articles[idx] = { ...db.articles[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveDB(db);
  res.json({ ok: true, article: db.articles[idx] });
});

// DELETE /api/articles/:id
app.delete('/api/articles/:id', (req, res) => {
  const db = getDB();
  db.articles = (db.articles||[]).filter(a => a.id !== req.params.id && a.slug !== req.params.id);
  saveDB(db);
  res.json({ ok: true });
});

// ============================================================
// API — PENDING (articles waiting for review)
// ============================================================
app.get('/api/pending', (req, res) => {
  const db = getDB();
  res.json({ pending: db.pending || [] });
});

app.post('/api/pending', (req, res) => {
  const db = getDB();
  if (!db.pending) db.pending = [];
  const item = { ...req.body, id: req.body.id||`pnd_${Date.now()}`, createdAt: new Date().toISOString() };
  db.pending.push(item);
  saveDB(db);
  res.json({ ok: true, item });
});

// ============================================================
// API — ANALYTICS
// ============================================================
app.get('/api/analytics', (req, res) => {
  const db = getDB();
  res.json({ analytics: db.analytics || [] });
});

app.post('/api/analytics', (req, res) => {
  const db = getDB();
  if (!db.analytics) db.analytics = [];
  db.analytics.push({ ...req.body, createdAt: new Date().toISOString() });
  if (db.analytics.length > 1000) db.analytics = db.analytics.slice(-1000);
  saveDB(db);
  res.json({ ok: true });
});

// ============================================================
// API — STATS
// ============================================================
app.get('/api/stats', (req, res) => {
  const db = getDB();
  const articles = (db.articles||[]).filter(a => a.status==='published'||!a.status);
  const cats = {};
  articles.forEach(a => { cats[a.category||'other'] = (cats[a.category||'other']||0)+1; });
  res.json({
    totalArticles: articles.length,
    totalViews: articles.reduce((s,a)=>s+(a.views||0),0),
    categories: cats,
    lastUpdated: articles[0]?.createdAt || null
  });
});

// ============================================================
// WEBHOOK — n8n article webhook (backward compat)
// ============================================================
app.post('/webhook/article', (req, res) => {
  // Same as POST /api/articles but for n8n
  const db = getDB();
  if (!db.articles) db.articles = [];
  const body = req.body;
  const article = {
    id: body.id || `art_${Date.now()}`,
    slug: body.slug || slugify(body.title || ''),
    title: body.title || '',
    summary: body.summary || body.excerpt || '',
    contentAr: body.contentAr || body.content || '',
    contentEs: body.contentEs || '',
    category: body.category || 'local-news',
    image: body.image || body.imageUrl || '',
    tags: body.tags || [],
    faq: body.faq || [],
    status: 'published',
    views: 0,
    createdAt: body.createdAt || new Date().toISOString(),
    publishedAt: body.publishedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: body.source || '',
    sourceUrl: body.sourceUrl || body.url || '',
    facebookPost: body.facebookPost || '',
    score: body.score || 0
  };

  const existing = db.articles.findIndex(a => a.id===article.id||a.slug===article.slug);
  if (existing !== -1) {
    db.articles[existing] = { ...db.articles[existing], ...article };
  } else {
    db.articles.unshift(article);
    // Keep max 500 articles
    if (db.articles.length > 500) db.articles = db.articles.slice(0, 500);
  }

  saveDB(db);
  console.log(`✅ Article saved: ${article.title}`);
  res.json({ ok: true, id: article.id, slug: article.slug });
});

// ============================================================
// PAGE ROUTES
// ============================================================
const PUBLIC = path.join(__dirname, 'public');

app.get('/', (req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
app.get('/article', (req, res) => res.sendFile(path.join(PUBLIC, 'article.html')));
app.get('/about', (req, res) => res.sendFile(path.join(PUBLIC, 'about.html')));
app.get('/contact', (req, res) => res.sendFile(path.join(PUBLIC, 'contact.html')));
app.get('/privacy', (req, res) => res.sendFile(path.join(PUBLIC, 'privacy.html')));
app.get('/search', (req, res) => res.sendFile(path.join(PUBLIC, 'search.html')));

// Category routes — serve category.html for all /category/* paths
app.get('/category/:cat', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'category.html'));
});

// Slug-based article routes /article/:slug
app.get('/article/:slug', (req, res) => {
  res.redirect(`/article?id=${req.params.slug}`);
});

// ============================================================
// SEO FILES
// ============================================================
app.get('/sitemap.xml', (req, res) => {
  const db = getDB();
  const articles = (db.articles||[]).filter(a=>a.status==='published'||!a.status);
  const baseUrl = process.env.SITE_URL || 'https://espana-hoy-production.up.railway.app';

  const staticUrls = ['/', '/about', '/contact', '/privacy',
    '/category/immigration','/category/residency','/category/jobs',
    '/category/housing','/category/education','/category/cost-of-living',
    '/category/government-benefits','/category/crime-safety',
    '/category/local-news','/category/tourism','/category/business'
  ].map(u => `
  <url>
    <loc>${baseUrl}${u}</loc>
    <changefreq>${u==='/'?'hourly':'weekly'}</changefreq>
    <priority>${u==='/'?'1.0':'0.8'}</priority>
  </url>`).join('');

  const articleUrls = articles.slice(0,200).map(a => `
  <url>
    <loc>${baseUrl}/article?id=${a.slug||a.id}</loc>
    <lastmod>${(a.updatedAt||a.createdAt||'').split('T')[0]||new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('');

  res.setHeader('Content-Type','application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${articleUrls}
</urlset>`);
});

app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.SITE_URL || 'https://espana-hoy-production.up.railway.app';
  res.type('text/plain').send(
`User-agent: *
Allow: /
Disallow: /api/
Disallow: /webhook/

Sitemap: ${baseUrl}/sitemap.xml`
  );
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ============================================================
// 404 fallback
// ============================================================
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.status(404).sendFile(path.join(PUBLIC, 'index.html'));
});

// ============================================================
// HELPERS
// ============================================================
function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[\u0600-\u06FF\s]+/g, match => match.replace(/\s+/g, '-'))
    .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80) || `article-${Date.now()}`;
}

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 إسبانيا اليوم running on port ${PORT}`);
  console.log(`📁 DB: ${fs.existsSync(DB_PATH) ? DB_PATH : DB_LOCAL}`);
});
