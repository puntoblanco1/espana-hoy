const express     = require('express');
const cors        = require('cors');
const compression = require('compression');
const path        = require('path');
const db          = require('./api/database');

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── n8n Webhook Receivers ─────────────────────────────
app.post('/webhook/espana-hoy-stories', (req, res) => {
  try { res.json({ success: true, id: db.savePendingStory(req.body) }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/webhook/espana-hoy-publish-wp', (req, res) => {
  try {
    const id   = db.publishArticle(req.body);
    const slug = req.body.arabic_slug || id;
    res.json({ success: true, id, url: `/article/${slug}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/webhook/espana-hoy-get-pending', (req, res) => {
  try { res.json({ posts: db.getPendingFacebookPosts() }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/webhook/espana-hoy-mark-published', (req, res) => {
  try { db.markFacebookPublished(req.body.fb_post_id, req.body.published_at); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/webhook/espana-hoy-analytics-list', (req, res) => {
  try { res.json({ articles: db.getPublishedWithFbIds() }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/webhook/espana-hoy-save-analytics', (req, res) => {
  try { db.saveAnalytics(req.body); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Public API ────────────────────────────────────────
app.get('/api/articles', (req, res) => {
  const { page = 1, category, limit = 12 } = req.query;
  res.json(db.getArticles({ page: parseInt(page), category, limit: parseInt(limit) }));
});

app.get('/api/article/:slug', (req, res) => {
  const article = db.getArticleBySlug(req.params.slug);
  if (!article) return res.status(404).json({ error: 'Not found' });
  db.incrementViews(article.id);
  res.json(article);
});

app.get('/api/stats', (req, res) => res.json(db.getStats()));

// ── Sitemap ───────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  try {
    const base     = process.env.BASE_URL || 'https://espana-hoy-production.up.railway.app';
    const articles = db.getArticles({ page: 1, limit: 500 }).articles;
    const cats     = ['immigration','residency','jobs','housing','education',
      'cost-of-living','government-benefits','crime-safety','local-news','tourism','business'];
    const now = new Date().toISOString().split('T')[0];

    const staticUrls = ['','about','contact','privacy'].map(p => `
  <url><loc>${base}/${p}</loc><lastmod>${now}</lastmod><changefreq>${p===''?'hourly':'monthly'}</changefreq><priority>${p===''?'1.0':'0.6'}</priority></url>`);

    const catUrls = cats.map(c => `
  <url><loc>${base}/category/${c}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>`);

    const articleUrls = articles.map(a => `
  <url><loc>${base}/article/${a.arabic_slug}</loc><lastmod>${(a.created_at||now).split('T')[0]}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`);

    res.setHeader('Content-Type', 'application/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...staticUrls,...catUrls,...articleUrls].join('')}\n</urlset>`);
  } catch(e) { res.status(500).send('Sitemap error'); }
});

// ── Robots.txt ────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  const base = process.env.BASE_URL || 'https://espana-hoy-production.up.railway.app';
  res.setHeader('Content-Type', 'text/plain');
  res.send(`User-agent: *\nAllow: /\nDisallow: /webhook/\nDisallow: /api/\n\nSitemap: ${base}/sitemap.xml`);
});

// ── Frontend Routes ───────────────────────────────────
const pub = (f) => (req, res) => res.sendFile(path.join(__dirname, 'public', f));
app.get('/',                pub('index.html'));
app.get('/article/:slug',   pub('article.html'));
app.get('/category/:cat',   pub('category.html'));
app.get('/about',           pub('about.html'));
app.get('/contact',         pub('contact.html'));
app.get('/privacy',         pub('privacy.html'));

// ── Start ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`España Hoy running on port ${PORT}`);
  db.init();
});
