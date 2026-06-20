const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(express.json());

// Explicit ads.txt route for AdSense crawler
app.get('/ads.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send('google.com, pub-1741541929933036, DIRECT, f08c47fec0942fa0\n');
});

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

// GET /api/articles/:id  (by id or slug or arabic_slug)
app.get('/api/articles/:id', (req, res) => {
  const db = getDB();
  const articles = db.articles || [];
  const { id } = req.params;
  const article = articles.find(a => a.id === id || a.slug === id || a.arabic_slug === id);
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
const API_SECRET = process.env.API_SECRET || 'espana2025secure';
function requireAuth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.key;
  if (key !== API_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

app.post('/api/articles', requireAuth, (req, res) => {
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
app.delete('/api/articles/:id', requireAuth, (req, res) => {
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
  
  // GUARD: reject error articles from AI failures
  if (!body.title || body.title.startsWith('خطأ في توليد') || body._skip) {
    console.log('⚠️ Skipping error article:', body.title || 'no title');
    return res.json({ ok: false, skipped: true, reason: 'error_article' });
  }
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

// Seed v2 — 30 new articles
app.get('/api/seed-v2', (req, res) => {
  if (req.query.key !== 'espana2025') return res.status(403).json({ error: 'Forbidden' });
  try {
    delete require.cache[require.resolve('./seed-articles-v2.js')];
    require('./seed-articles-v2.js');
    const db = getDB();
    res.json({ ok: true, total: (db.articles || []).length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Cleanup error articles
app.get('/api/cleanup-errors', (req, res) => {
  if (req.query.key !== 'espana2025') return res.status(403).json({ error: 'Forbidden' });
  const db = getDB();
  const before = (db.articles || []).length;
  db.articles = (db.articles || []).filter(a => {
    const t = a.title || '';
    return !t.startsWith('خطأ في توليد') && !t.startsWith('Error generando') && t.length > 5;
  });
  const removed = before - db.articles.length;
  saveDB(db);
  console.log(`🧹 Cleanup: removed ${removed} error articles. Remaining: ${db.articles.length}`);
  res.json({ ok: true, removed, remaining: db.articles.length });
});



// Fix articles that have arabic_slug = "MISSING" — copy from slug field
app.get('/api/fix-slugs', (req, res) => {
  if (req.query.key !== 'espana2025') return res.status(403).json({ error: 'Forbidden' });
  const db = getDB();
  let fixed = 0;
  (db.articles || []).forEach(a => {
    if (!a.arabic_slug || a.arabic_slug === 'MISSING') {
      a.arabic_slug = a.slug || a.id;
      fixed++;
    }
  });
  saveDB(db);
  console.log(`🔧 fix-slugs: fixed ${fixed} articles`);
  res.json({ ok: true, fixed, total: (db.articles||[]).length });
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

// Slug-based article routes /article/:slug — serve HTML directly (SEO-friendly)
app.get('/article/:slug', (req, res) => {
  res.sendFile(path.join(PUBLIC, 'article.html'));
});

// ============================================================
// SEO FILES
// ============================================================
app.get('/sitemap.xml', (req, res) => {
  const db = getDB();
  const articles = (db.articles||[]).filter(a=>a.status==='published'||!a.status);
  const baseUrl = process.env.SITE_URL || 'https://www.espaniaalyoum.com';

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
    <loc>${baseUrl}/article/${a.arabic_slug||a.slug||a.id}</loc>
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
  const baseUrl = process.env.SITE_URL || 'https://www.espaniaalyoum.com';
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
// SEED ENDPOINT — GET /api/seed-now?key=espana2025
// ============================================================
const SEED_ARTICLES = [
  {id:'art_imm_001',slug:'تجديد-تصريح-الاقامة-اسبانيا-2025',title:'خطوات تجديد تصريح الإقامة في إسبانيا 2026 — دليل عملي شامل',summary:'دليل محدث لتجديد بطاقة الإقامة في إسبانيا 2026: المستندات المطلوبة، مواعيد الحجز، والأخطاء الأكثر شيوعاً.',contentAr:'<h2>ما هو تصريح الإقامة؟</h2><p>تصريح الإقامة هو الوثيقة الرسمية التي تُثبت حقك في الإقامة والعمل في إسبانيا. يجب تجديده قبل انتهاء صلاحيته بـ 60 يوماً على الأقل.</p><h2>المستندات المطلوبة للتجديد</h2><ul><li>استمارة EX-17 مكتملة وموقعة</li><li>جواز السفر ساري المفعول + نسخة</li><li>صورة شخصية حديثة بخلفية بيضاء</li><li>إثبات الإقامة (empadronamiento)</li><li>إثبات الدخل أو العمل (آخر 3 نومينا)</li><li>إيصال دفع رسوم Tasa 790 Código 052</li></ul><h2>خطوات التجديد</h2><p><strong>الخطوة الأولى:</strong> احجز موعداً عبر extranjeros.inclusion.gob.es قبل 30 يوماً.</p><p><strong>الخطوة الثانية:</strong> ادفع رسوم الـ Tasa 790 في أي بنك إسباني بين 16 و200 يورو.</p><p><strong>الخطوة الثالثة:</strong> احضر إلى مكتب الأجانب بكل المستندات الأصلية والنسخ.</p><p><strong>الخطوة الرابعة:</strong> انتظر من 1 إلى 3 أشهر لاستلام البطاقة الجديدة.</p><h2>أخطاء شائعة</h2><ul><li>التأخر في الحجز — المواعيد تمتلئ بسرعة</li><li>نسيان نسخة من أي وثيقة</li><li>دفع رسوم غير صحيحة</li></ul>',category:'residency',image:'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80',tags:['إقامة','تجديد','وثائق','مكتب الأجانب'],faq:[{q:'كم تكلفة تجديد الإقامة في إسبانيا؟',a:'تتراوح بين 16 يورو للإقامة الدائمة و200 يورو لبعض أنواع الإقامة المؤقتة.'},{q:'كم يستغرق تجديد الإقامة؟',a:'من شهر إلى 3 أشهر. خلال هذه الفترة يصدر لك إيصال رسمي يُثبت أنك في وضع قانوني.'}],status:'published',createdAt:new Date(Date.now()-1*3600000).toISOString()},
  {id:'art_imm_002',slug:'الفيزا-الذهبية-اسبانيا',title:'الفيزا الذهبية في إسبانيا: شروط الحصول عليها وبدائلها بعد الإلغاء',summary:'كل ما تحتاج معرفته عن الفيزا الذهبية الإسبانية: شروطها، مميزاتها، وما البدائل المتاحة بعد قرار إلغائها.',contentAr:'<h2>ما هي الفيزا الذهبية؟</h2><p>تأشيرة إقامة مخصصة للمستثمرين الأجانب من خارج الاتحاد الأوروبي مقابل استثمار مالي كبير. تُمنح لمدة 3 سنوات قابلة للتجديد.</p><h2>شروط الحصول عليها</h2><ul><li>شراء عقار بقيمة 500,000 يورو أو أكثر</li><li>استثمار مليوني يورو في أسهم شركات إسبانية</li><li>إيداع مليوني يورو في بنك إسباني</li></ul><h2>مزاياها</h2><ul><li>إقامة قانونية كاملة وحق التنقل في منطقة شنغن</li><li>تشمل الزوج والأبناء تحت 18 سنة</li><li>لا يشترط الإقامة الفعلية للتجديد</li><li>إمكانية الإقامة الدائمة بعد 5 سنوات</li></ul><h2>تحديثات 2024</h2><p>أعلنت الحكومة عزمها إلغاء الفيزا المرتبطة بشراء العقارات. يُنصح باستشارة محامٍ متخصص.</p>',category:'immigration',image:'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',tags:['فيزا ذهبية','استثمار','عقارات','إقامة'],faq:[{q:'هل تلغى الفيزا الذهبية؟',a:'أعلنت الحكومة عزمها إلغاء نوع الفيزا المرتبط بالعقارات. تابع آخر التشريعات.'},{q:'كم يستغرق الحصول عليها؟',a:'من 20 يوم عمل إلى 3 أشهر حسب مكان التقديم وكمال الملف.'}],status:'published',createdAt:new Date(Date.now()-2*3600000).toISOString()},
  {id:'art_jobs_001',slug:'متوسط-الرواتب-اسبانيا-2025',title:'متوسط الرواتب في إسبانيا 2026 — دليل قطاع بقطاع للعرب',summary:'أرقام حقيقية لمتوسط رواتب إسبانيا 2026 في كل القطاعات: التقنية، الصحة، التعليم، والضيافة.',contentAr:'<h2>الحد الأدنى للأجور 2025</h2><p>رفعت إسبانيا الحد الأدنى للأجور ليصل إلى <strong>1,134 يورو شهرياً</strong> أي 15,876 يورو سنوياً.</p><h2>الرواتب حسب القطاع</h2><h3>التقنية والبرمجة</h3><ul><li>مطور مبتدئ: 25,000 - 35,000 يورو سنوياً</li><li>مطور متوسط: 35,000 - 50,000 يورو سنوياً</li><li>مطور أول: 50,000 - 70,000 يورو سنوياً</li></ul><h3>الضيافة والسياحة</h3><ul><li>نادل: 18,000 - 22,000 يورو سنوياً</li><li>موظف استقبال: 20,000 - 26,000 يورو سنوياً</li></ul><h3>الصحة</h3><ul><li>ممرض: 24,000 - 32,000 يورو سنوياً</li><li>طبيب عام: 35,000 - 50,000 يورو سنوياً</li></ul><h2>أفضل مواقع البحث عن عمل</h2><ul><li>InfoJobs.net — الأكثر شيوعاً</li><li>LinkedIn — للوظائف المتخصصة</li><li>Indeed.es — متنوع وسهل</li></ul>',category:'jobs',image:'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80',tags:['رواتب','عمل','SMI','وظائف'],faq:[{q:'كم الحد الأدنى للراتب 2025؟',a:'1,134 يورو شهرياً أي 15,876 يورو سنوياً موزعة على 14 راتباً.'},{q:'أي قطاع يدفع أكثر؟',a:'قطاع التقنية والبرمجة هو الأعلى أجراً، يليه القطاع الصحي.'}],status:'published',createdAt:new Date(Date.now()-3*3600000).toISOString()},
  {id:'art_housing_001',slug:'ايجار-شقة-اسبانيا-2025',title:'دليل استئجار شقة في إسبانيا 2026 — الخطوات والأوراق والأسعار',summary:'دليل عملي لاستئجار شقة في إسبانيا: العقد، الضمانات، حقوقك كمستأجر، وأسعار الإيجار في كبرى المدن.',contentAr:'<h2>أسعار الإيجار 2025</h2><h3>مدريد</h3><ul><li>استوديو: 900 - 1,300 يورو/شهر</li><li>غرفتان: 1,200 - 1,800 يورو/شهر</li><li>3 غرف: 1,600 - 2,500 يورو/شهر</li></ul><h3>برشلونة</h3><ul><li>استوديو: 900 - 1,400 يورو/شهر</li><li>غرفتان: 1,300 - 2,000 يورو/شهر</li></ul><h3>بلنسية وإشبيلية</h3><ul><li>استوديو: 500 - 750 يورو/شهر</li><li>غرفتان: 700 - 1,100 يورو/شهر</li></ul><h2>الوثائق المطلوبة</h2><ul><li>NIE أو DNI</li><li>عقد العمل أو إثبات الدخل</li><li>آخر 3 نومينا</li></ul><h2>ما تدفعه عند التوقيع</h2><ul><li>تأمين Fianza: شهر إيجار</li><li>ضمان إضافي: حتى شهرين</li><li>شهر مقدم</li></ul><h2>حقوقك كمستأجر</h2><ul><li>مدة العقد الدنيا: 5 سنوات</li><li>زيادة الإيجار مقيدة بنسبة التضخم</li></ul>',category:'housing',image:'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',tags:['إيجار','شقة','سكن','مدريد'],faq:[{q:'كم تحتاج لدفعه عند الاستئجار؟',a:'عادةً 3-4 أشهر إيجار: شهر تأمين + شهر مقدم + ضمان إضافي محتمل.'},{q:'هل يمكن الاستئجار بدون NIE؟',a:'صعب لكن بعض الملاك يقبلون جواز السفر.'}],status:'published',createdAt:new Date(Date.now()-4*3600000).toISOString()},
  {id:'art_edu_001',slug:'تسجيل-الاطفال-في-مدارس-اسبانيا',title:'تسجيل الأطفال في المدارس الإسبانية — الشروط والأوراق والمواعيد',summary:'دليل تسجيل أطفالك في المدارس الحكومية الإسبانية: الأوراق المطلوبة، مواعيد التسجيل، والفرق بين المدارس.',contentAr:'<h2>النظام التعليمي</h2><p>التعليم في إسبانيا إلزامي ومجاني من سن 6 إلى 16 سنة.</p><ul><li>Educación Primaria: 6-12 سنة</li><li>ESO: 12-16 سنة</li><li>Bachillerato: 16-18 سنة (للجامعة)</li></ul><h2>التسجيلات</h2><p>تفتح عادةً في مارس وأبريل للعام الدراسي القادم.</p><h2>المستندات المطلوبة</h2><ul><li>شهادة الميلاد مترجمة رسمياً</li><li>شهادة التطعيمات</li><li>إثبات الإقامة (Empadronamiento)</li><li>تصريح الإقامة أو NIE</li></ul><h2>أنواع المدارس</h2><ul><li>Colegios Públicos: مجانية تماماً</li><li>Colegios Concertados: رسوم رمزية</li><li>Colegios Privados: 400-2000 يورو/شهر</li></ul><h2>برامج اللغة</h2><p>تقدم المدارس برامج Aulas de Acogida لتعليم الإسبانية للأطفال الجدد.</p>',category:'education',image:'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80',tags:['تعليم','مدارس','أطفال','تسجيل'],faq:[{q:'هل التعليم مجاني للمهاجرين؟',a:'نعم، التعليم الحكومي مجاني لجميع الأطفال بغض النظر عن وضعهم القانوني.'},{q:'هل يحتاج طفلي لمعرفة الإسبانية؟',a:'لا، المدارس تقدم برامج خاصة لتعليم اللغة. الأطفال يندمجون بسرعة.'}],status:'published',createdAt:new Date(Date.now()-5*3600000).toISOString()},
  {id:'art_col_001',slug:'تكلفة-المعيشة-اسبانيا-2025',title:'تكلفة المعيشة في إسبانيا 2026 — كم تحتاج شهرياً بالأرقام؟',summary:'حساب تفصيلي لتكلفة المعيشة في إسبانيا 2026: الإيجار، الطعام، المواصلات، والخدمات في المدن الكبرى.',contentAr:'<h2>ميزانية شهرية في مدريد (شخص واحد)</h2><ul><li>الإيجار: 900-1,300 يورو</li><li>المواصلات: 54 يورو</li><li>البقالة: 250-350 يورو</li><li>الكهرباء والإنترنت: 100-150 يورو</li><li>الترفيه: 100-200 يورو</li><li><strong>المجموع: 1,400-2,000 يورو/شهر</strong></li></ul><h2>لعائلة من 4 أفراد</h2><ul><li>الإيجار (3 غرف): 1,500-2,200 يورو</li><li>البقالة: 600-800 يورو</li><li>الخدمات: 150-200 يورو</li><li><strong>المجموع: 2,400-3,500 يورو/شهر</strong></li></ul><h2>أسعار البقالة</h2><ul><li>خبز 500جم: 1.2 يورو</li><li>حليب لتر: 0.9 يورو</li><li>بيض 12 حبة: 2.5 يورو</li><li>دجاجة كاملة: 6-9 يورو</li></ul><h2>نصائح للتوفير</h2><ul><li>تسوّق في Mercadona أو Lidl</li><li>استفد من Menú del día: 10-14 يورو لـ 3 أطباق</li><li>استخدم بنكاً رقمياً مثل Revolut أو N26</li></ul>',category:'cost-of-living',image:'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',tags:['معيشة','أسعار','ميزانية','نفقات'],faq:[{q:'كم راتب كافٍ للعيش في مدريد؟',a:'للعيش بشكل مريح كشخص أعزب تحتاج 1,800-2,500 يورو صافي.'},{q:'هل إسبانيا أغلى من فرنسا؟',a:'لا، إسبانيا أرخص بنسبة 15-25% من فرنسا وألمانيا.'}],status:'published',createdAt:new Date(Date.now()-6*3600000).toISOString()},
  {id:'art_gov_001',slug:'مزايا-حكومية-اسبانيا-للمقيمين',title:'الإعانات والمزايا الحكومية في إسبانيا — ما يحق للمقيم العربي الحصول عليه',summary:'دليل شامل بالإعانات الحكومية الإسبانية المتاحة للمقيمين: إعانة البطالة، الإسكان، الأطفال، والصحة.',contentAr:'<h2>إعانة البطالة (Prestación por Desempleo)</h2><ul><li>تحتاج 12 شهراً اشتراك في الضمان الاجتماعي</li><li>المبلغ: 70% من الراتب للأشهر الـ4 الأولى ثم 50%</li><li>المدة: 4 أشهر إلى 24 شهراً</li><li>التقديم في SEPE خلال 15 يوماً</li></ul><h2>Ingreso Mínimo Vital</h2><ul><li>للشخص المنفرد: حتى 607 يورو/شهر</li><li>للعائلة من 4 أفراد: حتى 1,100 يورو/شهر</li></ul><h2>مساعدات الإسكان</h2><ul><li>الحكومة: حتى 50% من الإيجار لبعض الحالات</li><li>كاتالونيا: منح تصل إلى 2,400 يورو سنوياً</li></ul><h2>الرعاية الصحية</h2><p>جميع المقيمين قانونياً يحق لهم الرعاية الصحية العامة مجاناً عبر أقرب مركز صحي.</p>',category:'government-benefits',image:'https://images.unsplash.com/photo-1532622785990-d2c36a76f5a6?w=800&q=80',tags:['إعانات','دعم حكومي','بطالة','ضمان اجتماعي'],faq:[{q:'هل يحق للأجانب الحصول على إعانة البطالة؟',a:'نعم، إذا كنت تعمل قانونياً وتدفع الاشتراكات لمدة 12 شهراً على الأقل.'},{q:'كيف أتقدم لإعانة الدخل الأدنى؟',a:'إلكترونياً عبر موقع الضمان الاجتماعي أو في أي مكتب Seguridad Social.'}],status:'published',createdAt:new Date(Date.now()-7*3600000).toISOString()},
  {id:'art_news_001',slug:'اسعار-الكهرباء-اسبانيا-2025',title:'أسعار الكهرباء في إسبانيا 2026 — أسباب الارتفاع وطرق تخفيض الفاتورة',summary:'لماذا ارتفعت أسعار الكهرباء في إسبانيا وكيف تخفض فاتورتك؟ نصائح عملية وتعريفات مدعومة للمقيمين.',contentAr:'<h2>لماذا ارتفعت أسعار الكهرباء؟</h2><ul><li>ارتفاع أسعار الغاز الطبيعي الأوروبي</li><li>الاعتماد على محطات التوليد التقليدية</li><li>ارتفاع تكاليف نقل الطاقة وصيانة الشبكة</li><li>الضرائب والرسوم الحكومية</li></ul><h2>متوسط الفاتورة الشهرية</h2><ul><li>شقة صغيرة: 50-80 يورو</li><li>شقة متوسطة: 80-130 يورو</li><li>منزل كبير: 150-250 يورو</li></ul><h2>طرق تخفيض الفاتورة</h2><p><strong>1. تعريفة الساعات المتغيرة:</strong> توفر 20-30% إذا استخدمت الأجهزة ليلاً.</p><p><strong>2. الساعات الرخيصة:</strong> منتصف الليل حتى 8 صباحاً وعطلة نهاية الأسبوع.</p><p><strong>3. Bono Social:</strong> خصم حتى 65% للعائلات ذات الدخل المنخفض.</p><p><strong>4. مصابيح LED:</strong> توفر 80% من استهلاك الكهرباء.</p>',category:'local-news',image:'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&q=80',tags:['كهرباء','أسعار','فاتورة','توفير'],faq:[{q:'ما هو Bono Social للكهرباء؟',a:'خصم حكومي يصل إلى 65% على الفاتورة للعائلات ذات الدخل المنخفض.'},{q:'أفضل شركة كهرباء في إسبانيا؟',a:'Iberdrola, Endesa, Naturgy, Holaluz. قارن الأسعار عبر موقع CNMC.'}],status:'published',createdAt:new Date(Date.now()-8*3600000).toISOString()},
  {id:'art_tour_001',slug:'افضل-مدن-اسبانيا-للسياحة-2025',title:'أجمل 10 مدن في إسبانيا تستحق الزيارة — دليل سياحي للعرب 2026',summary:'اكتشف أجمل 10 مدن إسبانية تستحق الزيارة: ما يميز كل مدينة، أفضل وقت للزيارة، وتكلفة الرحلة.',contentAr:'<h2>1. مدريد</h2><ul><li>متحف البرادو: من أعظم متاحف الفن في العالم</li><li>بالاسيو ريال: القصر الملكي الأكبر في أوروبا الغربية</li><li>بويرتا ديل سول: قلب مدريد</li><li>حديقة ريتيرو: رئة مدريد الخضراء</li></ul><h2>2. برشلونة</h2><ul><li>Sagrada Família: كاتدرائية غاودي الأيقونية — احجز مسبقاً!</li><li>Park Güell: إطلالات بانورامية رائعة</li><li>لاس رامبلاس: الشارع الشهير</li></ul><h2>3. غرناطة</h2><ul><li>قصر الحمراء: تحفة معمارية إسلامية — احجز مسبقاً!</li><li>حي البيازين: الحي الأندلسي العربي الأصيل</li></ul><h2>4. إشبيلية</h2><ul><li>كاتدرائية إشبيلية: الأكبر في العالم الكاثوليكي</li><li>برج الذهب: رمز المدينة</li></ul><h2>5. بلنسية</h2><ul><li>مدينة الفنون والعلوم: معمار مستقبلي مذهل</li><li>مهرجان La Fallas في مارس</li></ul><h2>نصائح</h2><ul><li>أفضل توقيت: أبريل-يونيو وسبتمبر-أكتوبر</li><li>استخدم قطارات Renfe AVE بين المدن</li></ul>',category:'tourism',image:'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=800&q=80',tags:['سياحة','مدريد','برشلونة','غرناطة','إشبيلية'],faq:[{q:'ما أفضل وقت لزيارة إسبانيا؟',a:'أبريل-يونيو وسبتمبر-أكتوبر: الطقس معتدل والأسعار أقل.'},{q:'كم تكلف زيارة قصر الحمراء؟',a:'حوالي 19 يورو للبالغين. احجز مسبقاً لأن التذاكر تنفد سريعاً.'}],status:'published',createdAt:new Date(Date.now()-9*3600000).toISOString()},
  {id:'art_biz_001',slug:'فتح-شركة-في-اسبانيا-للعرب',title:'خطوات فتح شركة في إسبانيا — دليل المستثمر العربي الشامل',summary:'دليل عملي لفتح شركة في إسبانيا: أنواع الشركات، التكاليف، الإجراءات القانونية، والضرائب.',contentAr:'<h2>لماذا إسبانيا؟</h2><ul><li>رابع أكبر اقتصاد في اليورو</li><li>بوابة لأمريكا اللاتينية وأفريقيا</li><li>ضريبة الشركات 25%</li></ul><h2>أنواع الشركات</h2><h3>Autónomo</h3><ul><li>تسجيل سريع في يوم واحد</li><li>اشتراك الضمان الاجتماعي: من 230 يورو/شهر</li></ul><h3>SL (ذات مسؤولية محدودة)</h3><ul><li>رأس مال أدنى: 3,000 يورو</li><li>وقت التأسيس: أسبوعين إلى شهر</li></ul><h2>خطوات التأسيس</h2><p>1. حجز اسم الشركة في السجل التجاري المركزي</p><p>2. فتح حساب بنكي وإيداع رأس المال</p><p>3. توثيق عقد التأسيس أمام كاتب العدل (300-500 يورو)</p><p>4. التسجيل في مصلحة الضرائب والحصول على CIF</p><h2>أفضل القطاعات 2025</h2><ul><li>التقنية والبرمجيات</li><li>الطاقة المتجددة</li><li>السياحة والضيافة</li><li>الخدمات اللوجستية</li></ul>',category:'business',image:'https://images.unsplash.com/photo-1664575198308-3959904fa430?w=800&q=80',tags:['شركة','استثمار','أعمال','SL','ريادة'],faq:[{q:'كم يكلف فتح شركة؟',a:'بين 1,000 و2,500 يورو في الإجراءات، بالإضافة إلى رأس المال 3,000 يورو.'},{q:'هل يمكن للأجانب فتح شركة؟',a:'نعم، تحتاج فقط إلى NIE وجواز سفر ساري.'}],status:'published',createdAt:new Date(Date.now()-10*3600000).toISOString()},
  {id:'art_crime_001',slug:'امان-اسبانيا-للمقيمين-العرب',title:'مدى أمان إسبانيا للعرب المقيمين — إحصاءات وحقائق موثوقة',summary:'تقييم واقعي لمستوى الأمان في إسبانيا للجالية العربية: إحصاءات الجريمة، المناطق الآمنة، ونصائح الوقاية.',contentAr:'<h2>إسبانيا في مؤشرات الأمن</h2><p>إسبانيا ضمن أكثر 30 دولة أماناً في العالم. معدل الجريمة العنيفة منخفض جداً.</p><h2>الجرائم الأكثر شيوعاً</h2><h3>سرقة المتعلقات (Carterismo)</h3><p>خاصةً في محطات المترو والأماكن السياحية المزدحمة.</p><p><strong>الحماية:</strong> ضع محفظتك في الجيب الأمامي، لا تضع هاتفك على الطاولة.</p><h3>الاحتيال الإلكتروني</h3><p>احذر من SMS وهمية ومواقع إيجار شقق مزيفة.</p><h2>أرقام الطوارئ</h2><ul><li>112: الطوارئ العامة</li><li>091: الشرطة الوطنية</li><li>092: الشرطة البلدية</li></ul>',category:'crime-safety',image:'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',tags:['أمان','جريمة','شرطة','إسبانيا'],faq:[{q:'هل إسبانيا آمنة للعرب المسلمين؟',a:'نعم، مجتمع متسامح ويوجد مجتمع مسلم كبير. الجوامع موجودة في معظم المدن.'},{q:'أكثر جريمة شائعة؟',a:'سرقة المتعلقات في المناطق السياحية. الجرائم العنيفة نادرة.'}],status:'published',createdAt:new Date(Date.now()-11*3600000).toISOString()},
  {id:'art_imm_003',slug:'الحصول-على-الجنسية-الاسبانية',title:'شروط الحصول على الجنسية الإسبانية — كل الطرق والمدد الزمنية',summary:'دليل شامل للحصول على الجنسية الإسبانية: طريق الإقامة، الزواج، والأصول الإسبانية مع المدد والشروط.',contentAr:'<h2>طرق الحصول على الجنسية</h2><p>الجنسية الإسبانية من أقوى جوازات السفر (100+ دولة بدون فيزا).</p><h2>1. بالإقامة</h2><ul><li>10 سنوات: للحالة العامة (معظم العرب)</li><li>5 سنوات: للاجئين المعترف بهم</li><li>2 سنة: لمواطني أمريكا اللاتينية والبرتغال</li><li>سنة واحدة: للمولودين في إسبانيا أو أبناء الإسبان</li></ul><h2>2. بالزواج</h2><p>بعد سنة واحدة من الزواج القانوني بشرط اجتياز DELE A2 وCCSE.</p><h2>شروط التقديم</h2><ul><li>الإقامة القانونية للمدة المطلوبة</li><li>اجتياز DELE A2 وCCSE</li><li>خلو السجل الجنائي</li></ul><h2>وقت المعالجة</h2><p>من 1 إلى 3 سنوات. التقديم الآن إلكترونياً عبر Registro Civil online.</p>',category:'immigration',image:'https://images.unsplash.com/photo-1580048915913-4f8f5cb481c4?w=800&q=80',tags:['جنسية','إسبانية','جواز سفر','تجنيس'],faq:[{q:'كم سنة إقامة للجنسية الإسبانية؟',a:'للعرب عموماً 10 سنوات. الزواج من إسباني يخفض الشرط إلى سنة واحدة.'},{q:'هل يمكن الاحتفاظ بالجنسية العربية؟',a:'معظم الدول العربية لا تعترف بازدواجية الجنسية. استشر محامياً متخصصاً.'}],status:'published',createdAt:new Date(Date.now()-12*3600000).toISOString()},
{id:'art_imm_004',slug:'تصريح-عمل-اسبانيا-خطوات',title:'كيف تحصل على تصريح العمل في إسبانيا — الطرق القانونية والشروط',summary:'الطرق القانونية للحصول على تصريح العمل في إسبانيا: عقد العمل، arraigo laboral، والمهن المطلوبة.',contentAr:'<h2>طرق الحصول على تصريح العمل</h2><p>يُمنح تصريح العمل في إسبانيا ضمن تصريح الإقامة عادةً. فيما يلي أبرز الطرق:</p><h2>1. نظام الكفالة (Arraigo Laboral)</h2><ul><li>العمل 6 أشهر موثقة في إسبانيا</li><li>عقد عمل من صاحب عمل إسباني لمدة عام</li><li>التقديم من داخل إسبانيا</li></ul><h2>2. التأشيرة القادمة من الخارج</h2><p>تصدر للمهن التي تعاني نقصاً (النقص كالممرضين والمهندسين).</p><h2>3. الكفالة الاجتماعية (Arraigo Social)</h2><ul><li>الإقامة 3 سنوات بدون وثائق</li><li>إثبات الاندماج الاجتماعي</li><li>صلات عائلية أو عمل غير رسمي</li></ul><h2>الوثائق المطلوبة</h2><ul><li>جواز سفر ساري + نسخة</li><li>عقد عمل موثق رسمياً</li><li>Empadronamiento</li><li>استمارة EX-03</li></ul>',category:'immigration',image:'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80',tags:['تصريح عمل','كفالة','arraigo'],faq:[{q:'هل يمكن العمل أثناء انتظار تصريح الإقامة؟',a:'لا، إلا إذا كان لديك وثيقة إقامة سارية أو في فترة تجديد.'},{q:'كم تستغرق إجراءات تصريح العمل؟',a:'من 3 أشهر إلى 8 أشهر حسب المنطقة والحالة.'}],status:'published',createdAt:new Date(Date.now()-13*3600000).toISOString()},
  {id:'art_res_002',slug:'اقامة-دائمة-اسبانيا',title:'الإقامة الدائمة في إسبانيا — شروط الاستحقاق وخطوات التقديم',summary:'متى تستحق الإقامة الدائمة في إسبانيا وكيف تقدم؟ الشروط والوثائق والفرق بين الإقامة الدائمة والمؤقتة.',contentAr:'<h2>ما هي الإقامة الدائمة؟</h2><p>تصريح الإقامة الدائمة (Residencia Permanente) يُمنح بعد 5 سنوات من الإقامة القانونية المستمرة ويُجدَّد كل 5 سنوات تلقائياً.</p><h2>الشروط</h2><ul><li>الإقامة القانونية 5 سنوات متواصلة</li><li>عدم الغياب أكثر من 10 أشهر خلال الـ5 سنوات</li><li>خلو السجل الجنائي</li><li>موارد اقتصادية كافية</li></ul><h2>المزايا</h2><ul><li>العمل في أي مجال بحرية تامة</li><li>الحق في الاستفادة من الخدمات الاجتماعية</li><li>لم تعد مقيداً بصاحب عمل واحد</li><li>تجديد أسهل وأسرع</li></ul><h2>خطوات التقديم</h2><p>1. احجز موعداً في مكتب الأجانب عبر extranjeros.inclusion.gob.es</p><p>2. قدم استمارة EX-11</p><p>3. ادفع Tasa 790 كود 052</p>',category:'residency',image:'https://images.unsplash.com/photo-1568992688065-536aad8a12f6?w=800&q=80',tags:['إقامة دائمة','5 سنوات','EX-11'],faq:[{q:'هل تُفقد الإقامة الدائمة بالسفر؟',a:'لا، ما لم تغب أكثر من سنة كاملة متواصلة خارج إسبانيا.'},{q:'هل الإقامة الدائمة تختلف عن الجنسية؟',a:'نعم، الجنسية تمنح جواز سفر وحق التصويت. الإقامة الدائمة لا تمنحهما لكنها مستقرة جداً.'}],status:'published',createdAt:new Date(Date.now()-14*3600000).toISOString()},
  {id:'art_jobs_002',slug:'افضل-مواقع-عمل-اسبانيا-2025',title:'أفضل 8 مواقع للبحث عن عمل في إسبانيا 2026 — دليل عملي',summary:'أفضل المواقع الإلكترونية للبحث عن وظائف في إسبانيا مع نصائح لكتابة CV يناسب سوق العمل الإسباني.',contentAr:'<h2>أفضل المواقع</h2><h3>1. InfoJobs.net</h3><p>الأكثر شعبية في إسبانيا، يحتوي على ملايين الوظائف يومياً.</p><h3>2. LinkedIn.com</h3><p>الأفضل للوظائف التقنية والإدارية. أنشئ ملفاً محدثاً بالإسبانية والإنجليزية.</p><h3>3. Indeed.es</h3><p>يجمع من مصادر متعددة. سهل ومريح للبحث.</p><h3>4. Tecnoempleo.com</h3><p>متخصص في التقنية والبرمجة.</p><h3>5. Turijobs.com</h3><p>متخصص في السياحة والضيافة.</p><h3>6. SEPE.es</h3><p>الموقع الرسمي للعمالة في إسبانيا.</p><h3>7. Habitissimo.es</h3><p>للعمال الحرفيين والخدمات.</p><h3>8. Milanuncios.com</h3><p>للوظائف العرضية والمؤقتة.</p><h2>نصائح للسيرة الذاتية</h2><ul><li>استخدم نموذج Europass — مقبول في كل أوروبا</li><li>اكتب بالإسبانية دائماً</li><li>ضع صورة شخصية واضحة</li><li>لا تتجاوز صفحتين</li></ul>',category:'jobs',image:'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&q=80',tags:['بحث عمل','InfoJobs','LinkedIn','سيرة ذاتية'],faq:[{q:'أي موقع أفضل للعرب في إسبانيا؟',a:'InfoJobs الأشهر والأوسع. للتقنيين Tecnoempleo. للضيافة Turijobs.'},{q:'هل أحتاج إلى إسبانية ممتازة؟',a:'للبدء تكفي المستوى B1. كثير من الشركات تقبل العمل بالإنجليزية أيضاً.'}],status:'published',createdAt:new Date(Date.now()-15*3600000).toISOString()},
  {id:'art_housing_002',slug:'شراء-شقة-في-اسبانيا-للعرب',title:'دليل شراء شقة في إسبانيا للمقيمين العرب — الخطوات والتكاليف',summary:'كل ما تحتاج معرفته لشراء شقة في إسبانيا: الإجراءات، الضرائب، تكاليف التوثيق، والقروض العقارية.',contentAr:'<h2>هل يمكن للأجنبي شراء عقار؟</h2><p>نعم، المقيمون الأجانب يحق لهم شراء العقارات في إسبانيا بنفس حقوق المواطنين.</p><h2>التكاليف عند الشراء</h2><ul><li>ضريبة النقل ITP: 6-10% من سعر العقار</li><li>رسوم كاتب العدل: 600-900 يورو</li><li>رسوم التسجيل: 400-600 يورو</li><li>رسوم المحامي: 1% من السعر</li></ul><h2>الوثائق المطلوبة</h2><ul><li>NIE ساري المفعول</li><li>حساب بنكي إسباني</li><li>شهادة خلو السجل الجنائي</li></ul><h2>أفضل المناطق للاستثمار</h2><ul><li>بلنسية: عوائد إيجار 5-7%</li><li>ملقا: سوق قوي ومستقر</li><li>مدريد: ارتفاع مستمر</li></ul><h2>التمويل العقاري (Hipoteca)</h2><p>البنوك الإسبانية تمول 70-80% من قيمة العقار للأجانب. تحتاج 20-30% دفعة مقدمة.</p>',category:'housing',image:'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',tags:['شراء عقار','إسبانيا','hipoteca','استثمار'],faq:[{q:'هل يمكن الشراء قبل الحصول على الإقامة؟',a:'نعم، تحتاج فقط إلى NIE وهو مختلف عن تصريح الإقامة.'},{q:'ما الحد الأدنى لشراء عقار في إسبانيا؟',a:'لا يوجد حد أدنى قانوني، لكن للفيزا الذهبية لازم 500,000 يورو.'}],status:'published',createdAt:new Date(Date.now()-16*3600000).toISOString()},
  {id:'art_edu_002',slug:'تعلم-الاسبانية-بسرعة-للعرب',title:'تعلم الإسبانية بسرعة — أفضل الطرق والمصادر المجانية لعرب إسبانيا',summary:'دليل عملي لتعلم اللغة الإسبانية بسرعة: أفضل التطبيقات والمراكز والدورات المجانية المتاحة في إسبانيا.',contentAr:'<h2>لماذا تعلم الإسبانية ضروري؟</h2><ul><li>شرط للجنسية: اجتياز DELE A2</li><li>يزيد فرص العمل 3 أضعاف</li><li>يسهل تعاملاتك اليومية</li></ul><h2>المستويات</h2><ul><li>A1-A2: أساسيات التواصل اليومي (3-6 أشهر)</li><li>B1-B2: محادثة مريحة وعمل (6-12 شهر)</li><li>C1-C2: تخصص واحتراف (سنتان+)</li></ul><h2>أفضل الموارد المجانية</h2><ul><li>Duolingo: 15 دقيقة يومياً، ممتع للمبتدئين</li><li>BBC Mundo: لقراءة وسماع الإسبانية الحقيقية</li><li>SpanishPod101: محادثات مع مثيلة حقيقية</li><li>Tandem: شريك مكالمة إسباني لتبادل اللغات</li></ul><h2>دورات مجانية في إسبانيا</h2><ul><li>مدارس اللغات الرسمية EOI: من 100 يورو سنوياً</li><li>جمعيات المهاجرين تقدم دورات مجانية في كل مدينة</li></ul>',category:'education',image:'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80',tags:['إسبانية','تعلم لغة','DELE','Duolingo'],faq:[{q:'كم وقت يلزم لتعلم الإسبانية من الصفر؟',a:'6-12 شهر للتواصل اليومي. الناطقون بالعربية يجدون الإسبانية أصعب من الإنجليزية لكنها ممكنة.'},{q:'ما مستوى الإسبانية المطلوب للجنسية؟',a:'DELE A2 وهو المستوى المبتدئ المتقدم. ممكن اجتيازه خلال 6 أشهر دراسة جادة.'}],status:'published',createdAt:new Date(Date.now()-17*3600000).toISOString()},
  {id:'art_col_002',slug:'اسعار-الطعام-اسبانيا-2025',title:'أسعار الطعام والمطاعم في إسبانيا 2026 — دليل ميزانية العرب',summary:'دليل أسعار الطعام في إسبانيا 2026: تكلفة السوبرماركت والمطاعم والوجبات اليومية في كبرى المدن.',contentAr:'<h2>أسعار البقالة الأساسية</h2><ul><li>رغيف الخبز 500جم: 1.2 يورو</li><li>حليب لتر: 0.9 يورو</li><li>دجاجة كاملة: 6-9 يورو</li><li>لحم بقري 1 كيلو: 12-18 يورو</li><li>أرز 1 كيلو: 1.5-2 يورو</li><li>زيت زيتون 1 لتر: 5-8 يورو</li><li>بيض 12 حبة: 2.2-3 يورو</li><li>طماطم 1 كيلو: 1.5-2.5 يورو</li></ul><h2>أسعار المطاعم</h2><ul><li>Menú del Día (ثلاثة أطباق + شراب): 10-15 يورو</li><li>ساندوتش بوكاديلو: 3-5 يورو</li><li>بيتزا متوسطة: 10-15 يورو</li><li>وجبة بمطعم عادي: 12-20 يورو/شخص</li></ul><h2>أرخص السلاسل</h2><ul><li>Mercadona: الأفضل جودة وسعر</li><li>Lidl: أرخص وبجودة جيدة</li><li>Aldi: مميز لمنتجات الألبان</li><li>Dia: مناسب للعروض اليومية</li></ul><h2>الأسواق العربية</h2><p>تجد في معظم المدن الكبرى متاجر عربية بأسعار تنافسية للمنتجات المستوردة (حلال، عربي، شرقي).</p>',category:'cost-of-living',image:'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&q=80',tags:['أسعار','طعام','مطاعم','Mercadona'],faq:[{q:'هل الأكل الحلال متوفر في إسبانيا؟',a:'نعم، في المدن الكبيرة (مدريد، برشلونة، بلنسية) متاجر ومطاعم حلال وفيرة.'},{q:'ما هو Menú del Día؟',a:'وجبة غداء كاملة (شوربة أو سلطة + طبق رئيسي + حلوى + شراب) بسعر ثابت 10-15 يورو.'}],status:'published',createdAt:new Date(Date.now()-18*3600000).toISOString()},
  {id:'art_gov_002',slug:'التامين-الصحي-في-اسبانيا',title:'التأمين الصحي في إسبانيا — كيف تسجل وما حقوقك كمقيم',summary:'دليل شامل للرعاية الصحية في إسبانيا: طريقة التسجيل في المركز الصحي، البطاقة الصحية، وحقوقك.',contentAr:'<h2>النظام الصحي في إسبانيا</h2><p>إسبانيا لديها نظام صحي عام (Sistema Nacional de Salud) يُصنف ضمن أفضل 10 في العالم. المقيمون القانونيون يحق لهم الاستفادة منه مجاناً.</p><h2>كيفية التسجيل</h2><ul><li>اذهب إلى أقرب مركز صحي (Centro de Salud)</li><li>أحضر تصريح الإقامة + Empadronamiento + جواز السفر</li><li>ستحصل على Tarjeta Sanitaria (البطاقة الصحية)</li></ul><h2>ما يغطيه النظام</h2><ul><li>زيارات الطبيب العام</li><li>طوارئ مستشفى (Urgencias)</li><li>عمليات جراحية ضرورية</li><li>أدوية مدعومة (30-90% خصم)</li><li>رعاية الأمومة والطفل</li></ul><h2>ما لا يغطيه</h2><ul><li>طب الأسنان (أساسيات فقط)</li><li>النظارات والعدسات</li><li>بعض الأدوية غير المدعومة</li></ul><h2>التأمين الخاص</h2><p>شركات مثل Sanitas، Adeslas، Cigna تقدم تأميناً خاصاً من 50-100 يورو/شهر يمنحك وصولاً أسرع.</p>',category:'government-benefits',image:'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&q=80',tags:['صحة','تأمين','مركز صحي','بطاقة صحية'],faq:[{q:'هل الرعاية الصحية مجانية لكل المقيمين؟',a:'نعم للمقيمين قانونياً. وحتى غير النظاميين يحق لهم الطوارئ والأطفال تحت 18 سنة.'},{q:'كم ينتظر المرء لرؤية الطبيب؟',a:'الطبيب العام: 1-3 أيام. المتخصص: أسابيع. لهذا كثيرون يلجؤون للتأمين الخاص.'}],status:'published',createdAt:new Date(Date.now()-19*3600000).toISOString()},
  {id:'art_news_002',slug:'احوال-الطقس-اسبانيا-2025',title:'دليل طقس إسبانيا — أفضل وأسوأ وقت للزيارة في كل منطقة',summary:'دليل شامل لطقس إسبانيا: متى تزور الشمال والجنوب والجزر؟ أفضل المواسم وما تتوقعه في كل منطقة.',contentAr:'<h2>المناطق المناخية في إسبانيا</h2><h3>المنطقة المتوسطية (شرق وجنوب)</h3><p>برشلونة، بلنسية، مرسية، ملقا — صيف حار وجاف، شتاء معتدل دافئ.</p><h3>المنطقة الداخلية (المسطح الإيبيري)</h3><p>مدريد، سرقسطة — صيف شديد الحرارة (40°) وشتاء بارد (تحت 0°).</p><h3>المنطقة الشمالية الخضراء</h3><p>بيلباو، سان سيباستيان، لاكورونيا — رطوبة عالية، مطر وفير، شتاء معتدل.</p><h3>جزر الكناري</h3><p>ربيع دائم — 22° طوال السنة. وجهة مثالية للشتاء.</p><h2>أفضل مواسم كل مدينة</h2><ul><li>مدريد: أبريل-يونيو وسبتمبر-نوفمبر</li><li>برشلونة: مايو-يونيو وسبتمبر-أكتوبر</li><li>إشبيلية: مارس-مايو (الصيف حار جداً 45°)</li><li>ملقا: طوال السنة تقريباً</li></ul>',category:'local-news',image:'https://images.unsplash.com/photo-1513326738677-b964603b136d?w=800&q=80',tags:['طقس','مناخ','إسبانيا','مواسم'],faq:[{q:'ما أبرد منطقة في إسبانيا شتاءً؟',a:'المناطق الداخلية كمدريد وسوريا حيث تنخفض درجات الحرارة إلى ما دون الصفر.'},{q:'هل يثلج في إسبانيا؟',a:'نعم في الجبال وبعض المدن الداخلية. مدريد تشهد ثلجاً أحياناً كما حدث في يناير 2021.'}],status:'published',createdAt:new Date(Date.now()-20*3600000).toISOString()},
  {id:'art_tour_002',slug:'جزر-الكناري-السياحة-2025',title:'جزر الكناري — دليل السياحة الكامل للعرب: الأسعار والمواصلات والجزر الأفضل',summary:'دليل سياحي شامل لجزر الكناري للعرب: أفضل الجزر، تكلفة الرحلة، الفنادق، والأنشطة المتاحة.',contentAr:'<h2>لماذا جزر الكناري؟</h2><p>جزر الكناري ليست مجرد شاطئ — إنها 8 جزر أتلانطية بطقس ربيعي دائم (20-25°C) وتنوع طبيعي مذهل.</p><h2>أشهر الجزر</h2><h3>تينيريفي</h3><ul><li>الأكبر والأكثر شعبية</li><li>بركان التيدي — أعلى قمة في إسبانيا (3,715م)</li><li>منتجع لوس كريستيانوس</li></ul><h3>غران كاناريا</h3><ul><li>كثبان رمال Maspalomas الشهيرة</li><li>Las Palmas — مدينة نابضة بالحياة</li></ul><h3>لانساروتي</h3><ul><li>تضاريس بركانية فريدة</li><li>Jameos del Agua وFire Mountains</li></ul><h2>كيف تصل</h2><ul><li>رحلات مباشرة من مدريد: 2.5 ساعة بـ 60-150 يورو</li><li>رحلات مباشرة من برشلونة: 3 ساعات</li><li>شركات Vueling، Iberia، Ryanair</li></ul><h2>ميزانية الرحلة</h2><ul><li>فندق 3 نجوم: 50-80 يورو/ليلة</li><li>شقة مفروشة: 40-70 يورو/ليلة</li><li>الأكل: 20-40 يورو/يوم</li></ul>',category:'tourism',image:'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80',tags:['جزر الكناري','تينيريفي','سياحة','شواطئ'],faq:[{q:'هل جزر الكناري تحتاج تأشيرة منفصلة؟',a:'لا، جزر الكناري جزء من إسبانيا والاتحاد الأوروبي. نفس تأشيرة شنغن.'},{q:'أفضل وقت لزيارة جزر الكناري؟',a:'ممتاز طوال السنة. لكن يناير-مارس هو الأهدأ والأرخص.'}],status:'published',createdAt:new Date(Date.now()-21*3600000).toISOString()},
  {id:'art_biz_002',slug:'ضرائب-العمل-الحر-اسبانيا',title:'دليل الضرائب للعمل الحر Autónomo في إسبانيا — ما تدفعه وكيف توفر',summary:'كل ما يجب أن يعرفه العامل الحر عن الضرائب في إسبانيا: IRPF، IVA، الاشتراكات الاجتماعية، والخصومات.',contentAr:'<h2>الاشتراكات الاجتماعية الشهرية</h2><p>أكبر عبء على الـ Autónomo هو اشتراك الضمان الاجتماعي.</p><ul><li>الحد الأدنى: 230 يورو/شهر</li><li>يشمل: الرعاية الصحية + التقاعد + إجازة مرضية</li><li>ميزة المبتدئين: 80 يورو فقط أول سنتين (Tarifa Plana)</li></ul><h2>ضريبة الدخل IRPF</h2><p>تدفع 15% استقطاع على كل فاتورة للشركات (7% أول 3 سنوات).</p><ul><li>البيان السنوي في أبريل-يونيو</li><li>الشرائح من 19% إلى 47% حسب الدخل</li></ul><h2>ضريبة القيمة المضافة IVA</h2><ul><li>المعدل العام: 21%</li><li>الخدمات الصحية والتعليمية: معفاة</li><li>الغذاء الأساسي: 4%</li></ul><h2>المصاريف القابلة للخصم</h2><ul><li>إيجار المكتب أو جزء من الشقة</li><li>الإنترنت والهاتف (50%)</li><li>المعدات والبرمجيات</li><li>السيارة (إذا استُخدمت مهنياً)</li><li>التدريب والكورسات</li></ul>',category:'business',image:'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&q=80',tags:['autónomo','ضرائب','IRPF','IVA','عمل حر'],faq:[{q:'هل يمكن العمل كـ Autónomo بدون إقامة دائمة؟',a:'نعم، تحتاج NIE وتصريح إقامة ساري ويسمح لك بالعمل.'},{q:'متى يجب تحويل autónomo إلى شركة SL؟',a:'عندما يتجاوز دخلك 45,000 يورو سنوياً لأن ضريبة الشركات 25% أفضل من IRPF 47%.'}],status:'published',createdAt:new Date(Date.now()-22*3600000).toISOString()},
  {id:'art_imm_005',slug:'عائلة-مقيم-لم-الشمل-اسبانيا',title:'لم شمل العائلة في إسبانيا — الشروط والوثائق وأوقات الانتظار',summary:'كيف تجيب عائلتك للعيش معك في إسبانيا؟ شروط لم الشمل، الوثائق المطلوبة، ومدة الإجراءات.',contentAr:'<h2>من يحق إحضاره؟</h2><ul><li>الزوج/الزوجة</li><li>الأبناء تحت 18 سنة</li><li>الأبناء فوق 18 ولكن في عهدة أو معاقون</li><li>الآباء والأجداد في حالات خاصة</li></ul><h2>شروط مقدم الطلب</h2><ul><li>إقامة قانونية لمدة سنة على الأقل + تصريح إقامة صالح سنتين</li><li>سكن مناسب (مساحة كافية للعائلة)</li><li>دخل كافٍ: الحد الأدنى + 50% لكل فرد</li><li>خلو السجل الجنائي</li></ul><h2>الوثائق المطلوبة</h2><ul><li>استمارة EX-02</li><li>عقد إيجار أو ملكية</li><li>آخر 3 شهور رواتب</li><li>شهادات ميلاد الأبناء + وثيقة الزواج — مترجمة ومُصادق عليها</li></ul><h2>المدة</h2><p>من 3 إلى 9 أشهر. يحصل أفراد العائلة على تصريح إقامة مستقل بعد الموافقة.</p>',category:'immigration',image:'https://images.unsplash.com/photo-1511895426328-dc8714191011?w=800&q=80',tags:['لم شمل','عائلة','إقامة','EX-02'],faq:[{q:'هل الزوجة تحصل على حق العمل بعد لم الشمل؟',a:'نعم، تصريح الإقامة لأفراد العائلة يتضمن حق العمل.'},{q:'كم يكلف طلب لم الشمل؟',a:'رسوم Tasa حوالي 70 يورو لكل فرد. بالإضافة لتكاليف ترجمة الوثائق.'}],status:'published',createdAt:new Date(Date.now()-23*3600000).toISOString()},
  {id:'art_news_003',slug:'اسبانيا-رقم-اول-2025',title:'إسبانيا في الأرقام 2026 — إحصاءات وحقائق مثيرة لا تعرفها',summary:'أرقام وإحصاءات مدهشة عن إسبانيا في 2026: الاقتصاد، السكان، الهجرة، والمجتمع بالأرقام الرسمية.',contentAr:'<h2>إسبانيا في أرقام 2025</h2><h3>السكان</h3><ul><li>47.4 مليون نسمة إجمالي</li><li>5.7 مليون أجنبي مقيم (12%)</li><li>أكثر من 900,000 مهاجر مغربي</li><li>الجالية العربية: تجاوزت 1.5 مليون</li></ul><h3>الاقتصاد</h3><ul><li>رابع أكبر اقتصاد في منطقة اليورو</li><li>الناتج المحلي: 1.47 تريليون يورو</li><li>البطالة: 11.5% (الأعلى في أوروبا الغربية)</li></ul><h3>السياحة</h3><ul><li>ثاني أكثر وجهة سياحية في العالم</li><li>85 مليون سائح في 2024</li><li>الدخل السياحي: 100 مليار يورو</li></ul><h3>الجالية المسلمة</h3><ul><li>2 مليون مسلم في إسبانيا (4% من السكان)</li><li>1,600 مسجد ومصلى</li><li>مدريد + برشلونة + سبتة: أعلى كثافة</li></ul>',category:'local-news',image:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',tags:['إسبانيا','أرقام','إحصاءات','عرب'],faq:[{q:'كم عدد العرب في إسبانيا؟',a:'يُقدر بأكثر من 1.5 مليون، معظمهم من المغرب والجزائر ومصر والأردن.'},{q:'ما أكبر جالية عربية في إسبانيا؟',a:'الجالية المغربية هي الأكبر بفارق كبير، تليها الجزائرية.'}],status:'published',createdAt:new Date(Date.now()-24*3600000).toISOString()},
  {id:'art_res_003',slug:'NIE-اسبانيا-كيفية-الحصول',title:'NIE في إسبانيا — ما هو وكيف تحصل عليه وأين تستخدمه',summary:'دليل النيي NIE في إسبانيا: ما هو، من يحتاجه، كيف يحصل عليه، وما الفرق بينه وبين TIE.',contentAr:'<h2>ما هو NIE؟</h2><p>NIE هو Número de Identificación de Extranjero — رقم التعريف الضريبي للأجانب. بدونه لا يمكنك:</p><ul><li>فتح حساب بنكي</li><li>شراء عقار أو سيارة</li><li>التوقيع على عقد عمل</li><li>التسجيل في الجامعة</li><li>الحصول على خدمات حكومية</li></ul><h2>من داخل إسبانيا</h2><p>1. احجز موعداً في مراكز Extranjería أو مراكز الشرطة الوطنية</p><p>2. قدم: جواز سفر + استمارة EX-15 + إيصال دفع Tasa 790 (10 يورو)</p><p>3. احضر في الموعد وستُمنح فيه أو ترسل خلال أسابيع</p><h2>من الخارج</h2><p>يمكن الطلب من السفارة الإسبانية في بلدك قبل السفر.</p><h2>NIE مؤقت مقابل دائم</h2><ul><li>NIE مؤقت: لصفقة واحدة (شراء عقار من الخارج مثلاً)</li><li>NIE مع إقامة: دائم ومدمج في بطاقة الإقامة TIE</li></ul>',category:'residency',image:'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80',tags:['NIE','وثائق','أجانب','إسبانيا'],faq:[{q:'هل NIE نفسه DNI؟',a:'لا. DNI للمواطنين الإسبان، NIE للأجانب. لكن لهما نفس الوظيفة كرقم تعريف.'},{q:'كم يستغرق الحصول على NIE؟',a:'في يوم الموعد في الغالب. إذا قدمت إلكترونياً قد يستغرق 1-3 أسابيع.'}],status:'published',createdAt:new Date(Date.now()-25*3600000).toISOString()},
  {id:'art_crime_002',slug:'النصب-والاحتيال-اسبانيا-تحذيرات',title:'أشهر عمليات النصب التي تستهدف العرب في إسبانيا — كيف تحمي نفسك',summary:'تعرف على أخطر عمليات الاحتيال التي تستهدف الجالية العربية في إسبانيا وكيف تتجنبها بسهولة.',contentAr:'<h2>أشهر عمليات الاحتيال</h2><h3>1. شقق إيجار وهمية</h3><p>إعلانات بأسعار رخيصة جداً مع طلب دفع مقدم عبر تحويل بنكي.</p><p><strong>الوقاية:</strong> لا تدفع قبل معاينة الشقة شخصياً. تحقق من هوية المالك.</p><h3>2. وكالات توظيف وهمية</h3><p>يطلبون رسوماً مقدمة "للتسجيل" أو "إعداد الوثائق" ثم يختفون.</p><p><strong>الوقاية:</strong> لا تدفع للحصول على عمل. الوكالات الشرعية تأخذ عمولتها من صاحب العمل.</p><h3>3. الحسابات البنكية الوهمية</h3><p>SMS تدّعي أنها من بنكك تطلب بياناتك بحجة "تحديث الحساب".</p><p><strong>الوقاية:</strong> لا يطلب البنك أبداً كلمة مرورك عبر SMS.</p><h3>4. خدمات المحامين المزيفين</h3><p>يدّعون تسريع الإقامة بمبالغ طائلة.</p><p><strong>الوقاية:</strong> تحقق من ترخيص المحامي عبر موقع نقابة المحامين.</p><h2>ماذا تفعل إذا وقعت ضحية؟</h2><ul><li>بلّغ فوراً في أقرب مركز شرطة</li><li>احتفظ بكل الأدلة: رسائل، إيصالات، صور</li><li>أبلغ البنك لتجميد الحساب المشبوه</li></ul>',category:'crime-safety',image:'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=80',tags:['احتيال','نصب','تحذير','حماية'],faq:[{q:'هل يمكن استرداد المال بعد الاحتيال؟',a:'صعب لكن ليس مستحيلاً. بلّغ فوراً وسريعاً كلما زادت فرصة الاسترداد.'},{q:'هل النصب منتشر ضد العرب تحديداً؟',a:'المحتالون يستهدفون المهاجرين الجدد عموماً لأنهم لا يعرفون القواعد. التوعية هي أفضل وقاية.'}],status:'published',createdAt:new Date(Date.now()-26*3600000).toISOString()}

,
  {id:'art_imm_006',slug:'تاشيرة-دخول-اسبانيا-سياحة',title:'كيف تحصل على تأشيرة إسبانيا السياحية من مصر والمغرب والجزائر',summary:'خطوات الحصول على تأشيرة شنغن السياحية من أبرز الدول العربية — الوثائق المطلوبة ونسب القبول.',contentAr:'<h2>ما هي تأشيرة شنغن؟</h2><p>تأشيرة شنغن تتيح لك دخول 27 دولة أوروبية بتصريح واحد. مدتها تصل إلى 90 يوماً كل 180 يوم.</p><h2>الوثائق المطلوبة</h2><ul><li>جواز سفر سارٍ لمدة 6 أشهر على الأقل</li><li>صورتان شخصيتان بالمواصفات الأوروبية</li><li>كشف حساب بنكي 3 أشهر</li><li>حجز فندقي مؤكد أو دعوة رسمية</li><li>تذكرة طيران ذهاب وعودة</li><li>تأمين سفر لا يقل عن 30,000 يورو</li></ul><h2>نسب القبول 2024</h2><ul><li>المغرب: حوالي 65%</li><li>مصر: حوالي 72%</li><li>الأردن: حوالي 78%</li><li>تونس: حوالي 68%</li></ul><h2>نصائح لرفع نسبة القبول</h2><ul><li>أظهر ارتباطاً قوياً بالوطن (عمل، عقار، عائلة)</li><li>أثبت قدرتك المالية بوضوح</li><li>احجز من شركات سياحية موثوقة</li></ul>',category:"immigration",image:"https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80",tags:["تأشيرة","شنغن","سياحة","سفر"],faq:[{q:"كم يستغرق استخراج تأشيرة إسبانيا؟",a:"من 5 إلى 15 يوم عمل. تقدم قبل شهر من موعد سفرك."},{q:"هل أحتاج موعداً للسفارة؟",a:"نعم، احجز عبر موقع السفارة الإسبانية أو مراكز VFS Global."}],status:"published",createdAt:new Date(Date.now()-27*3600000).toISOString()},
  {id:'art_jobs_003',slug:'عمل-بدون-خبرة-اسبانيا',title:'وظائف في إسبانيا بدون خبرة — القطاعات الأكثر توظيفاً للعرب',summary:'دليل عملي لأفضل الوظائف المتاحة في إسبانيا للمهاجرين الجدد حتى بدون خبرة مسبقة أو إتقان كامل للإسبانية.',contentAr:'<h2>أكثر القطاعات توظيفاً</h2><h3>الضيافة والمطاعم</h3><p>الأكثر قبولاً للمبتدئين. نادل، مساعد مطبخ، موظف نظافة.</p><p>الراتب: 1,200-1,500 يورو. الميزة: إكراميات يومية.</p><h3>البناء والتشييد</h3><p>طلب مرتفع جداً والرواتب فوق المتوسط.</p><p>الراتب: 1,500-2,000 يورو. يشترط: قدرة جسمانية جيدة.</p><h3>الزراعة (Temporada)</h3><p>موسمي لكن مضمون — حصاد الفراولة (هويلبا)، البرتقال (بلنسية).</p><p>الراتب: 1,300-1,600 يورو + سكن أحياناً.</p><h3>التوصيل والخدمات اللوجستية</h3><p>مع شركات Glovo، Just Eat، Amazon، Correos.</p><p>شرط أساسي: رخصة قيادة إسبانية أو أوروبية.</p><h3>التنظيف والخدمات</h3><p>عمل داخلي بيوت أو شركات. مرن ومضمون.</p>',category:"jobs",image:"https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&q=80",tags:["وظائف","بدون خبرة","مبتدئين","عمل"],faq:[{q:"هل يمكن العمل أثناء تعلم الإسبانية؟",a:"نعم، كثير من أصحاب العمل يقبلون مستوى A1-A2 في قطاعات الضيافة والبناء."},{q:"كيف أجد عمل قبل الوصول لإسبانيا؟",a:"عبر LinkedIn وInfoJobs وإعلانات الجاليات العربية على فيسبوك."}],status:"published",createdAt:new Date(Date.now()-28*3600000).toISOString()},
  {id:'art_housing_003',slug:'سكن-طلاب-اسبانيا',title:'السكن الطلابي في إسبانيا — كل الخيارات والأسعار',summary:'دليل الطلاب العرب للسكن في إسبانيا: السكن الجامعي، الشقق المشتركة، Residencias وكيف تختار الأنسب لميزانيتك.',contentAr:'<h2>خيارات السكن الطلابي</h2><h3>Residencias Universitarias</h3><p>سكن جامعي رسمي — أمان وسعر معقول.</p><ul><li>تشمل: وجبات + إنترنت + مرافق</li><li>السعر: 500-900 يورو/شهر</li><li>التقديم: مبكراً — تمتلئ بسرعة!</li></ul><h3>Pisos Compartidos (شقق مشتركة)</h3><p>الأكثر شيوعاً بين الطلاب — توفير كبير.</p><ul><li>السعر: 300-600 يورو/شهر (غرفة فقط)</li><li>مواقع البحث: Idealista، Fotocasa، Badi</li></ul><h3>Colegios Mayores</h3><p>سكن عريق بتقاليد مميزة — شبكة تواصل قوية.</p><ul><li>السعر: 700-1,200 يورو/شهر</li><li>متاح في مدريد وبرشلونة وسلمنكا</li></ul><h2>مدن الجامعات الأفضل</h2><ul><li>سلمنكا: مدينة جامعية بامتياز، أرخص وأجمل</li><li>مدريد: فرص عمل أكثر</li><li>برشلونة: تنوع ثقافي لكن أغلى</li><li>بلنسية: توازن ممتاز</li></ul>',category:"housing",image:"https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&q=80",tags:["طلاب","سكن","جامعة","شقة مشتركة"],faq:[{q:"متى أبحث عن سكن طلابي؟",a:"اطلب من مايو-يونيو للعام الدراسي القادم. التأخر يعني قلة الخيارات."},{q:"هل يوجد دعم للسكن للطلاب الأجانب؟",a:"بعض الجامعات تقدم منحاً للسكن. استفسر من قسم الرعاية الطلابية."}],status:"published",createdAt:new Date(Date.now()-29*3600000).toISOString()},
  {id:'art_edu_003',slug:'الدراسة-في-جامعات-اسبانيا-للعرب',title:'الدراسة في الجامعات الإسبانية — دليل الطالب العربي الشامل',summary:'كل ما تحتاجه لاستكمال دراستك في إسبانيا: أفضل الجامعات، رسوم القبول، التأشيرة الطلابية، ومنح الدراسة.',contentAr:'<h2>أفضل الجامعات الإسبانية 2025</h2><ul><li>جامعة برشلونة (UB): الأعلى تصنيفاً عالمياً</li><li>جامعة مدريد المستقلة (UAM): قوية في البحث العلمي</li><li>جامعة سلمنكا: الأعرق تاريخياً (تأسست 1218)</li><li>جامعة بلنسية: ممتازة وأقل تكلفة</li></ul><h2>الرسوم الدراسية</h2><ul><li>البكالوريوس في الجامعات الحكومية: 750-2,500 يورو/سنة</li><li>الماجستير: 1,500-5,000 يورو/سنة</li><li>الجامعات الخاصة: 5,000-15,000 يورو/سنة</li></ul><h2>التأشيرة الطلابية</h2><ul><li>قدم في القنصلية الإسبانية في بلدك</li><li>شرط: خطاب قبول من الجامعة</li><li>إثبات التغطية المالية: 600-700 يورو/شهر</li></ul><h2>منح الدراسة</h2><ul><li>منحة Erasmus+: للدراسة في دول أوروبية أخرى</li><li>منح الحكومة الإسبانية عبر MAEC-AECID</li><li>منح الجامعات للطلاب المتفوقين</li></ul>',category:"education",image:"https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80",tags:["جامعة","دراسة","طلاب","منح"],faq:[{q:"هل الجامعات الإسبانية تدرس بالإسبانية؟",a:"معظمها نعم، لكن كثير من الماجستيرات متاحة بالإنجليزية. تتوسع البرامج الإنجليزية سنوياً."},{q:"هل الشهادة الإسبانية معترف بها دولياً؟",a:"نعم، شهادات الجامعات الإسبانية الحكومية معترف بها في كل أوروبا وكثير من دول العالم."}],status:"published",createdAt:new Date(Date.now()-30*3600000).toISOString()},
  {id:'art_col_003',slug:'المواصلات-في-اسبانيا-دليل',title:'المواصلات في إسبانيا — كل ما تحتاج معرفته للتنقل باقتصاد',summary:'دليل شامل للتنقل في إسبانيا: المترو، الحافلات، القطارات، وكيف توفر في تكاليف المواصلات اليومية والسفر بين المدن.',contentAr:'<h2>داخل المدن</h2><h3>مدريد</h3><ul><li>المترو: 13 خط يغطي المدينة كلها</li><li>تذكرة واحدة: 1.5-2 يورو</li><li>بطاقة شهرية للشباب تحت 26: 8 يورو/شهر فقط!</li><li>بطاقة شهرية عادية: 54 يورو</li></ul><h3>برشلونة</h3><ul><li>T-Casual (10 تذاكر): 11.35 يورو</li><li>التنقل بالدراجة عبر Bicing: 50 يورو/سنة</li></ul><h2>بين المدن</h2><h3>قطارات Renfe AVE</h3><ul><li>مدريد-برشلونة: ساعتان ونصف (30-120 يورو)</li><li>مدريد-إشبيلية: ساعتان ونصف</li><li>احجز مبكراً للحصول على سعر Básico المنخفض</li></ul><h3>الحافلات</h3><ul><li>أرخص من القطار بـ 50-70%</li><li>مريحة ومكيفة</li><li>شركات: Alsa، Avanza، FlixBus</li></ul><h2>نصائح التوفير</h2><ul><li>بطاقة +Renfe لمن فوق 60 سنة: 30% خصم</li><li>Abono Joven (18-26 سنة) في مدريد: ثمن رمزي</li></ul>',category:"cost-of-living",image:"https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&q=80",tags:["مواصلات","مترو","قطار","توفير"],faq:[{q:"هل تحتاج سيارة للعيش في مدريد أو برشلونة؟",a:"لا على الإطلاق. المواصلات العامة ممتازة وامتلاك سيارة في المدن الكبرى مكلف."},{q:"هل رخصة القيادة العربية صالحة في إسبانيا؟",a:"لمدة 6 أشهر فقط. بعدها لازم تستبدلها برخصة إسبانية عبر DGT."}],status:"published",createdAt:new Date(Date.now()-31*3600000).toISOString()},
  {id:'art_gov_003',slug:'الضمان-الاجتماعي-اسبانيا-دليل',title:'الضمان الاجتماعي في إسبانيا — حقوقك كاملة خطوة بخطوة',summary:'دليل شامل لفهم نظام الضمان الاجتماعي في إسبانيا: التسجيل، الاشتراكات، التقاعد، وكيف تستفيد من كل حقوقك.',contentAr:'<h2>ما هو الضمان الاجتماعي؟</h2><p>Seguridad Social هو نظام يحميك عند المرض، الحوادث، البطالة، والتقاعد. صاحب العمل يدفع معظم الاشتراك (29%) وأنت تدفع 6.35% من راتبك.</p><h2>التسجيل</h2><ul><li>صاحب العمل يسجلك تلقائياً عند بداية العقد</li><li>كعامل مستقل تسجل نفسك في أقرب مكتب Seguridad Social</li></ul><h2>ماذا يغطي</h2><ul><li>رعاية صحية مجانية كاملة</li><li>إجازة مرضية مدفوعة (75% من الراتب)</li><li>إجازة أمومة 16 أسبوع مدفوعة</li><li>البطالة (بشرط الاشتراك 12 شهراً)</li><li>التقاعد (بعد 15 سنة اشتراك)</li></ul><h2>معاش التقاعد</h2><ul><li>15 سنة كحد أدنى للاستحقاق</li><li>37 سنة للمعاش الكامل</li><li>سن التقاعد: 66 سنة و8 أشهر في 2025</li></ul>',category:"government-benefits",image:"https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80",tags:["ضمان اجتماعي","تقاعد","حقوق","عمل"],faq:[{q:"هل يُحتسب الضمان الاجتماعي في بلد آخر؟",a:"نعم، بين دول الاتحاد الأوروبي سنوات الاشتراك تُجمع. لدول أخرى يعتمد على الاتفاقيات الثنائية."},{q:"ماذا لو تركت إسبانيا — هل أفقد اشتراكاتي؟",a:"لا، الاشتراكات محفوظة. يمكنك المطالبة بمعاش تقاعد إسباني عند بلوغ السن حتى من الخارج."}],status:"published",createdAt:new Date(Date.now()-32*3600000).toISOString()},
  {id:'art_news_004',slug:'اهم-احداث-اسبانيا-2025',title:'أبرز الأحداث والتطورات في إسبانيا في 2026',summary:'ملخص بأهم التطورات السياسية والاقتصادية والاجتماعية في إسبانيا خلال 2026 وتأثيرها على المقيمين العرب.',contentAr:'<h2>على الصعيد الاقتصادي</h2><p>إسبانيا تحقق نمواً اقتصادياً قوياً بنسبة 2.8% في 2024 متجاوزة توقعات صندوق النقد الدولي، مع تراجع تدريجي في نسبة البطالة.</p><h2>سوق العمل</h2><ul><li>طلب متصاعد على مهنيي التقنية والصحة</li><li>ارتفاع الحد الأدنى للأجور إلى 1,134 يورو</li><li>توسع برامج استقطاب المهاجرين المؤهلين</li></ul><h2>الإسكان</h2><p>استمرار أزمة الإسكان — الحكومة أعلنت حزمة بناء 40,000 وحدة اجتماعية جديدة.</p><h2>قوانين الهجرة</h2><p>تحديثات على نظام arraigo ومسارات جديدة للمهاجرين في القطاعات ذات الطلب العالي.</p><h2>المجتمع العربي</h2><p>تنامي مستمر للجالية العربية مع افتتاح مراكز ثقافية ومساجد جديدة في عدة مدن.</p>',category:"local-news",image:"https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80",tags:["أخبار","إسبانيا","2025","اقتصاد"],faq:[{q:"هل الوضع الاقتصادي في إسبانيا جيد للمهاجرين؟",a:"نسبياً نعم — الطلب على العمالة ارتفع خاصة في التقنية والصحة والسياحة."},{q:"هل هناك تيار مناهض للهجرة في إسبانيا؟",a:"هناك تصاعد لبعض الأصوات اليمينية، لكن إسبانيا لا تزال من أكثر دول أوروبا تقبلاً للمهاجرين."}],status:"published",createdAt:new Date(Date.now()-33*3600000).toISOString()},
  {id:'art_tour_003',slug:'مدريد-دليل-سياحي-عربي',title:'مدريد بعيون عربية — دليل سياحي كامل بالعربية',summary:'كل ما تحتاج معرفته لزيارة مدريد: أفضل الأحياء، المطاعم الحلال، المعالم السياحية، والتنقل داخل العاصمة.',contentAr:'<h2>أحياء مدريد الأهم</h2><h3>لاباييه (Lavapiés)</h3><p>أكثر أحياء مدريد تنوعاً — تجد فيه مطاعم عربية ومغربية وأسواق شرقية. حي شعبي حيوي.</p><h3>مالاسانيا وتشواكا</h3><p>عصري وفني — للتسوق والمقاهي والحياة الليلية المعتدلة.</p><h3>سالامانكا</h3><p>راقٍ وفاخر — تسوق ماركات عالمية في كالي سيرانو.</p><h2>أفضل المطاعم الحلال</h2><ul><li>Restaurante Al Mounia: أشهر مطعم مغربي في مدريد</li><li>Kebab y más: سريع وجيد</li><li>Baraka: مطبخ عربي متنوع</li></ul><h2>المعالم المجانية</h2><ul><li>متحف البرادو: مجاني من 6-8 مساءً</li><li>حديقة ريتيرو: مفتوحة 24 ساعة</li><li>بلازا مايور وبويرتا ديل سول: مجانية دائماً</li></ul><h2>نصيحة للعرب</h2><p>المترو الساعة 2-5 عصراً في فصل الصيف يكون ممتلئاً — تجنب أوقات الذروة وضع حقيبتك أمامك.</p>',category:"tourism",image:"https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800&q=80",tags:["مدريد","سياحة","حلال","دليل"],faq:[{q:"هل يوجد مسجد في مدريد؟",a:"نعم، أبرزها المركز الإسلامي بالقرب من Avenida de los Reyes Católicos وعدد من المصليات."},{q:"هل الأسعار في مدريد غالية للسياح؟",a:"أقل من باريس وأمستردام. الأكل في Menú del Día ممتاز وبأسعار معقولة."}],status:"published",createdAt:new Date(Date.now()-34*3600000).toISOString()},
  {id:'art_biz_003',slug:'فرص-عمل-حر-اسبانيا-2025',title:'أفضل فرص العمل الحر (Freelance) في إسبانيا للعرب',summary:'العمل الحر ينمو بسرعة في إسبانيا. اكتشف أفضل المجالات والمنصات والطريقة الصحيحة للتسجيل القانوني.',contentAr:'<h2>أكثر مجالات الفريلانس طلباً</h2><h3>البرمجة وتطوير المواقع</h3><p>الأعلى أجراً — 40-100 يورو/ساعة للمتخصصين.</p><h3>التصميم الجرافيكي والـ UX</h3><p>25-60 يورو/ساعة. المنصات: Behance، 99designs.</p><h3>الترجمة عربي-إسباني-إنجليزي</h3><p>طلب كبير في إسبانيا للترجمة العربية. 0.07-0.15 يورو/كلمة.</p><h3>تسويق رقمي</h3><p>إدارة مواقع التواصل، الإعلانات، السيو. 500-2000 يورو/مشروع.</p><h2>المنصات للعمل</h2><ul><li>Fiverr: الأشهر دولياً</li><li>Upwork: للعملاء الكبار</li><li>Malt.es: متخصص في السوق الإسبانية</li><li>LinkedIn ProFinder: للخدمات المهنية</li></ul><h2>الوضع القانوني</h2><p>يجب التسجيل كـ Autónomo حتى لو كسبت من الخارج. الضريبة الأولى 15% IRPF ثم حسب الشريحة.</p>',category:"business",image:"https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=800&q=80",tags:["فريلانس","عمل حر","برمجة","ترجمة"],faq:[{q:"هل يمكن العمل فريلانس لعملاء عرب من إسبانيا؟",a:"نعم، تستقبل الدفعات عبر PayPal أو Wise أو تحويل بنكي دولي. تدفع الضريبة في إسبانيا."},{q:"ما أدنى دخل يُلزمك بالتسجيل كـ Autónomo؟",a:"رسمياً من أول يورو ربحته بشكل منتظم. لكن كثيرون يسجلون عند تجاوز 3,000 يورو/سنة."}],status:"published",createdAt:new Date(Date.now()-35*3600000).toISOString()}

];

app.get('/api/seed-now', (req, res) => {
  if (req.query.key !== 'espana2025') return res.status(403).json({ error: 'forbidden' });
  const db = getDB();
  if (!db.articles) db.articles = [];
  let added = 0, updated = 0;
  for (const article of SEED_ARTICLES) {
    article.slug = article.slug || article.id;
    const idx = db.articles.findIndex(a => a.id === article.id || a.slug === article.slug);
    if (idx !== -1) { db.articles[idx] = { ...db.articles[idx], ...article }; updated++; }
    else { db.articles.unshift(article); added++; }
  }
  saveDB(db);
  res.json({ ok: true, added, updated, total: db.articles.length, msg: added + ' مقال جديد، ' + updated + ' محدّث' });
});

// ============================================================
// 404 handler
// ============================================================
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.status(404).sendFile(path.join(PUBLIC, '404.html'));
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

