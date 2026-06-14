const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE  = path.join(DATA_DIR, 'db.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) return { articles: [], pending: [], analytics: [] };
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch(e) { return { articles: [], pending: [], analytics: [] }; }
}

function save(db) {
  ensureDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function slugify(text) {
  return (text || '')
    .toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\u0600-\u06FF]/g, '')
    .replace(/\-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80) || 'article';
}

function normalizeCategory(cat) {
  const map = {
    'Immigration':'immigration','Residency':'residency','Jobs':'jobs',
    'Housing':'housing','Education':'education','Cost of Living':'cost-of-living',
    'Government Benefits':'government-benefits','Crime Safety':'crime-safety',
    'Local News':'local-news','Tourism':'tourism','Business':'business'
  };
  return map[cat] || (cat||'local-news').toLowerCase().replace(/\s+/g,'-');
}

// ── Public API ──────────────────────────────────────
function init() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) save({ articles: [], pending: [], analytics: [] });
  console.log('DB ready at', DB_FILE);
}

function savePendingStory(story) {
  const db = load();
  const record = { id: uid(), ...story, status: 'pending_generation', created_at: new Date().toISOString() };
  db.pending.push(record);
  save(db);
  return record.id;
}

function publishArticle(article) {
  const db = load();
  const id = uid();
  const slug_ar = article.arabic_slug  || slugify(article.arabic_title  || '') + '-' + id;
  const slug_es = article.spanish_slug || slugify(article.spanish_title || '') + '-' + id;
  const imageUrl = article.image_url ||
    `https://image.pollinations.ai/prompt/${encodeURIComponent(article.image_prompt || article.arabic_title || 'Spain news')}?width=1200&height=630&nologo=true&seed=${id}`;

  // Remove old duplicate slug if any
  db.articles = db.articles.filter(a => a.arabic_slug !== slug_ar && a.spanish_slug !== slug_es);

  const record = {
    id,
    arabic_title:            article.arabic_title            || '',
    arabic_seo_title:        article.arabic_seo_title        || article.arabic_title || '',
    arabic_meta_description: article.arabic_meta_description || '',
    arabic_slug:             slug_ar,
    arabic_content:          article.arabic_content          || '',
    arabic_faq:              article.arabic_faq              || '',
    spanish_title:           article.spanish_title           || '',
    spanish_seo_title:       article.spanish_seo_title       || article.spanish_title || '',
    spanish_meta_description:article.spanish_meta_description|| '',
    spanish_slug:            slug_es,
    spanish_content:         article.spanish_content         || '',
    spanish_faq:             article.spanish_faq             || '',
    keywords: Array.isArray(article.keywords) ? article.keywords.join(',') : (article.keywords || ''),
    category:    normalizeCategory(article.category),
    image_url:   imageUrl,
    image_prompt:article.image_prompt || '',
    source:      article.source       || '',
    source_link: article.source_link  || '',
    virality_score: article.virality_score || 0,
    views:       0,
    fb_post_id:  null,
    fb_published:false,
    status:      'published',
    created_at:  new Date().toISOString(),
    published_at:new Date().toISOString()
  };

  db.articles.unshift(record); // newest first
  save(db);
  return id;
}

function getArticles({ page = 1, category, limit = 12 } = {}) {
  const db = load();
  let list = db.articles.filter(a => a.status === 'published');
  if (category) list = list.filter(a => a.category === category);
  const total = list.length;
  const start = (page - 1) * limit;
  return {
    articles: list.slice(start, start + limit),
    total,
    page,
    pages: Math.ceil(total / limit)
  };
}

function getArticleBySlug(slug) {
  const db = load();
  return db.articles.find(a => (a.arabic_slug === slug || a.spanish_slug === slug) && a.status === 'published') || null;
}

function incrementViews(id) {
  const db = load();
  const a = db.articles.find(x => x.id === id);
  if (a) { a.views = (a.views || 0) + 1; save(db); }
}

function getPendingFacebookPosts() {
  const db = load();
  return db.articles
    .filter(a => a.status === 'published' && !a.fb_published)
    .slice(0, 3)
    .map(a => ({
      id: a.id,
      arabic_title: a.arabic_title,
      arabic_slug:  a.arabic_slug,
      image_url:    a.image_url,
      facebook_post_arabic: (a.facebook_post_arabic && a.facebook_post_arabic.includes('#العرب'))
        ? a.facebook_post_arabic
        : `${(a.arabic_meta_description||'').split('.')[0]}..\n\nهل تعرف كيف تستفيد من هذا؟ 🤔🇪🇸\n\n▼ اقرأ الخبر كاملاً في أول تعليق\n\n#العرب_في_إسبانيا #إسبانيا_اليوم #الهجرة_إلى_إسبانيا #العرب_في_أوروبا #وظائف_إسبانيا #إقامة_إسبانيا #مهاجرون_عرب #حياة_في_إسبانيا #الجالية_العربية #سكن_إسبانيا #عرب_مدريد #عرب_برشلونة #تعليم_إسبانيا #المغتربون_العرب #هجرة_عربية #España #ArabesEnEspaña #InmigracionEspana #VidaEnEspaña #TrabajoEnEspaña #EspanaHoy`,
      facebook_first_comment: `🔗 اقرأ المقال كاملاً:\nhttps://espana-hoy-production.up.railway.app/article/${a.arabic_slug}\n\nشارك مع أصدقائك ليستفيدوا ❤️\n\n#إسبانيا_اليوم #EspanaHoy`,
      wp_url: `https://espana-hoy-production.up.railway.app/article/${a.arabic_slug}`
    }));
}

function markFacebookPublished(fb_post_id, published_at) {
  const db = load();
  const unpublished = db.articles.filter(a => !a.fb_published);
  if (unpublished.length > 0) {
    const a = unpublished[0];
    a.fb_post_id   = fb_post_id;
    a.fb_published = true;
    a.fb_published_at = published_at || new Date().toISOString();
    save(db);
  }
}

function getPublishedWithFbIds() {
  const db = load();
  return db.articles
    .filter(a => a.fb_published && a.fb_post_id)
    .slice(0, 20)
    .map(a => ({ article_id: a.id, arabic_title: a.arabic_title, arabic_slug: a.arabic_slug, fb_post_id: a.fb_post_id }));
}

function saveAnalytics(data) {
  const db = load();
  db.analytics.push({ ...data, saved_at: new Date().toISOString() });
  if (db.analytics.length > 1000) db.analytics = db.analytics.slice(-1000);
  save(db);
}

function getStats() {
  const db = load();
  const published = db.articles.filter(a => a.status === 'published');
  const catCounts = {};
  published.forEach(a => { catCounts[a.category] = (catCounts[a.category] || 0) + 1; });
  const categories = Object.entries(catCounts).map(([cat, n]) => ({ category: cat, n })).sort((a,b) => b.n - a.n);
  const topViewed  = [...published].sort((a,b) => (b.views||0) - (a.views||0)).slice(0, 5)
    .map(a => ({ arabic_title: a.arabic_title, arabic_slug: a.arabic_slug, views: a.views || 0 }));
  return { total_articles: published.length, categories, top_viewed: topViewed };
}

module.exports = { init, savePendingStory, publishArticle, getArticles, getArticleBySlug, incrementViews, getPendingFacebookPosts, markFacebookPublished, getPublishedWithFbIds, saveAnalytics, getStats };
