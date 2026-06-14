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

// ── Fix FB posts with hashtags ────────────────────────
app.post('/webhook/fix-fb-hashtags', (req, res) => {
  try {
    const data = db.load ? db.load() : JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'data','db.json'),'utf8'));
    
    const hashtags = `\n\n#العرب_في_إسبانيا #إسبانيا_اليوم #الهجرة_إلى_إسبانيا #العرب_في_أوروبا #وظائف_إسبانيا #إقامة_إسبانيا #مهاجرون_عرب #حياة_في_إسبانيا #الجالية_العربية #سكن_إسبانيا #عرب_مدريد #عرب_برشلونة #تعليم_إسبانيا #المغتربون_العرب #هجرة_عربية #España #ArabesEnEspaña #InmigracionEspana #VidaEnEspaña #TrabajoEnEspaña #EspanaHoy`;

    let fixed = 0;
    (data.articles||[]).forEach(article => {
      if (!article.arabic_title) return;
      const desc   = article.arabic_meta_description || '';
      const teaser = desc.length > 20 ? desc.split('.')[0] : '';
      article.facebook_post_arabic    = `${teaser}\n\nهل تعرف كيف تستفيد من هذا؟ 🤔🇪🇸\n\n▼ اقرأ الخبر كاملاً في أول تعليق${hashtags}`;
      article.facebook_first_comment  = `🔗 اقرأ المقال كاملاً:\nhttps://espana-hoy-production.up.railway.app/article/${article.arabic_slug}\n\nشارك مع أصدقائك ليستفيدوا ❤️\n\n#إسبانيا_اليوم #EspanaHoy`;
      article.fb_published = false;
      article.fb_post_id   = null;
      fixed++;
    });

    require('fs').writeFileSync(require('path').join(__dirname,'data','db.json'), JSON.stringify(data, null, 2));
    res.json({ success: true, fixed });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
