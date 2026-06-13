const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const db = require('./api/database');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security & Performance ──────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', apiLimiter);

// ── Template engine ─────────────────────────────────────────────────
app.set('view engine', 'html');

// ── n8n Webhook Receivers ────────────────────────────────────────────

// Receive scored story from scraper workflow
app.post('/webhook/espana-hoy-stories', (req, res) => {
  try {
    const story = req.body;
    const id = db.savePendingStory(story);
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Receive generated article from AI workflow
app.post('/webhook/espana-hoy-publish-wp', (req, res) => {
  try {
    const article = req.body;
    const id = db.publishArticle(article);
    res.json({ success: true, id, url: `/article/${article.arabic_slug || id}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Return pending FB posts for Facebook publisher workflow
app.get('/webhook/espana-hoy-get-pending', (req, res) => {
  try {
    const posts = db.getPendingFacebookPosts();
    res.json({ posts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark story as published on Facebook
app.post('/webhook/espana-hoy-mark-published', (req, res) => {
  try {
    const { fb_post_id, published_at } = req.body;
    db.markFacebookPublished(fb_post_id, published_at);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Return published articles list for analytics
app.get('/webhook/espana-hoy-analytics-list', (req, res) => {
  try {
    const articles = db.getPublishedWithFbIds();
    res.json({ articles });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save analytics data
app.post('/webhook/espana-hoy-save-analytics', (req, res) => {
  try {
    db.saveAnalytics(req.body);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Public API ───────────────────────────────────────────────────────

// Homepage articles (Arabic)
app.get('/api/articles', (req, res) => {
  const { page = 1, category, lang = 'ar', limit = 12 } = req.query;
  const articles = db.getArticles({ page: parseInt(page), category, lang, limit: parseInt(limit) });
  res.json(articles);
});

// Single article by slug
app.get('/api/article/:slug', (req, res) => {
  const article = db.getArticleBySlug(req.params.slug);
  if (!article) return res.status(404).json({ error: 'Article not found' });
  db.incrementViews(article.id);
  res.json(article);
});

// Categories list
app.get('/api/categories', (req, res) => {
  res.json({
    categories: [
      { id: 'immigration', ar: 'الهجرة', es: 'Inmigración', icon: '✈️' },
      { id: 'residency', ar: 'الإقامة', es: 'Residencia', icon: '🏠' },
      { id: 'jobs', ar: 'الوظائف', es: 'Empleos', icon: '💼' },
      { id: 'housing', ar: 'السكن', es: 'Vivienda', icon: '🏘️' },
      { id: 'education', ar: 'التعليم', es: 'Educación', icon: '🎓' },
      { id: 'cost-of-living', ar: 'تكلفة المعيشة', es: 'Coste de vida', icon: '💰' },
      { id: 'government-benefits', ar: 'المساعدات', es: 'Ayudas', icon: '🤝' },
      { id: 'crime-safety', ar: 'الأمن', es: 'Seguridad', icon: '🛡️' },
      { id: 'local-news', ar: 'أخبار محلية', es: 'Noticias', icon: '📰' },
      { id: 'tourism', ar: 'السياحة', es: 'Turismo', icon: '🌅' },
      { id: 'business', ar: 'الأعمال', es: 'Negocios', icon: '📈' }
    ]
  });
});

// Stats for homepage
app.get('/api/stats', (req, res) => {
  res.json(db.getStats());
});

// ── Frontend Routes ──────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/article/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'article.html')));
app.get('/category/:cat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/es/*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ── Start ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`España Hoy | إسبانيا اليوم running on port ${PORT}`);
  db.init();
});
