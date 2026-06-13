const express    = require('express');
const cors       = require('cors');
const compression = require('compression');
const path       = require('path');
const db         = require('./api/database');

const app  = express();
const PORT = process.env.PORT || 8080;

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── n8n Webhook Receivers ─────────────────────────────
app.post('/webhook/espana-hoy-stories', (req, res) => {
  try {
    const id = db.savePendingStory(req.body);
    res.json({ success: true, id });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/webhook/espana-hoy-publish-wp', (req, res) => {
  try {
    const id  = db.publishArticle(req.body);
    const slug = req.body.arabic_slug || id;
    res.json({ success: true, id, url: `/article/${slug}` });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/webhook/espana-hoy-get-pending', (req, res) => {
  try { res.json({ posts: db.getPendingFacebookPosts() }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/webhook/espana-hoy-mark-published', (req, res) => {
  try {
    db.markFacebookPublished(req.body.fb_post_id, req.body.published_at);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
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

// ── Frontend ─────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/article/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'article.html')));
app.get('/category/:cat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`España Hoy running on port ${PORT}`);
  db.init();
});
