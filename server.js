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
// SEED ENDPOINT — GET /api/seed-now?key=espana2025
// ============================================================
const SEED_ARTICLES = [
  {id:'art_imm_001',slug:'تجديد-تصريح-الاقامة-اسبانيا-2025',title:'كيف تجدد تصريح إقامتك في إسبانيا 2025 — خطوة بخطوة',summary:'دليل شامل ومحدث لتجديد بطاقة الإقامة في إسبانيا: المستندات المطلوبة، المواعيد، والأخطاء الشائعة التي يجب تجنبها.',contentAr:'<h2>ما هو تصريح الإقامة؟</h2><p>تصريح الإقامة هو الوثيقة الرسمية التي تُثبت حقك في الإقامة والعمل في إسبانيا. يجب تجديده قبل انتهاء صلاحيته بـ 60 يوماً على الأقل.</p><h2>المستندات المطلوبة للتجديد</h2><ul><li>استمارة EX-17 مكتملة وموقعة</li><li>جواز السفر ساري المفعول + نسخة</li><li>صورة شخصية حديثة بخلفية بيضاء</li><li>إثبات الإقامة (empadronamiento)</li><li>إثبات الدخل أو العمل (آخر 3 نومينا)</li><li>إيصال دفع رسوم Tasa 790 Código 052</li></ul><h2>خطوات التجديد</h2><p><strong>الخطوة الأولى:</strong> احجز موعداً عبر extranjeros.inclusion.gob.es قبل 30 يوماً.</p><p><strong>الخطوة الثانية:</strong> ادفع رسوم الـ Tasa 790 في أي بنك إسباني بين 16 و200 يورو.</p><p><strong>الخطوة الثالثة:</strong> احضر إلى مكتب الأجانب بكل المستندات الأصلية والنسخ.</p><p><strong>الخطوة الرابعة:</strong> انتظر من 1 إلى 3 أشهر لاستلام البطاقة الجديدة.</p><h2>أخطاء شائعة</h2><ul><li>التأخر في الحجز — المواعيد تمتلئ بسرعة</li><li>نسيان نسخة من أي وثيقة</li><li>دفع رسوم غير صحيحة</li></ul>',category:'residency',image:'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&q=80',tags:['إقامة','تجديد','وثائق','مكتب الأجانب'],faq:[{q:'كم تكلفة تجديد الإقامة في إسبانيا؟',a:'تتراوح بين 16 يورو للإقامة الدائمة و200 يورو لبعض أنواع الإقامة المؤقتة.'},{q:'كم يستغرق تجديد الإقامة؟',a:'من شهر إلى 3 أشهر. خلال هذه الفترة يصدر لك إيصال رسمي يُثبت أنك في وضع قانوني.'}],status:'published',createdAt:new Date(Date.now()-1*3600000).toISOString()},
  {id:'art_imm_002',slug:'الفيزا-الذهبية-اسبانيا',title:'الفيزا الذهبية في إسبانيا: من يستحقها وكيف تحصل عليها',summary:'كل ما تحتاج معرفته عن تأشيرة المستثمر الذهبية في إسبانيا — الشروط، المبالغ المطلوبة، والمزايا التي تمنحها لك ولعائلتك.',contentAr:'<h2>ما هي الفيزا الذهبية؟</h2><p>تأشيرة إقامة مخصصة للمستثمرين الأجانب من خارج الاتحاد الأوروبي مقابل استثمار مالي كبير. تُمنح لمدة 3 سنوات قابلة للتجديد.</p><h2>شروط الحصول عليها</h2><ul><li>شراء عقار بقيمة 500,000 يورو أو أكثر</li><li>استثمار مليوني يورو في أسهم شركات إسبانية</li><li>إيداع مليوني يورو في بنك إسباني</li></ul><h2>مزاياها</h2><ul><li>إقامة قانونية كاملة وحق التنقل في منطقة شنغن</li><li>تشمل الزوج والأبناء تحت 18 سنة</li><li>لا يشترط الإقامة الفعلية للتجديد</li><li>إمكانية الإقامة الدائمة بعد 5 سنوات</li></ul><h2>تحديثات 2024</h2><p>أعلنت الحكومة عزمها إلغاء الفيزا المرتبطة بشراء العقارات. يُنصح باستشارة محامٍ متخصص.</p>',category:'immigration',image:'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&q=80',tags:['فيزا ذهبية','استثمار','عقارات','إقامة'],faq:[{q:'هل تلغى الفيزا الذهبية؟',a:'أعلنت الحكومة عزمها إلغاء نوع الفيزا المرتبط بالعقارات. تابع آخر التشريعات.'},{q:'كم يستغرق الحصول عليها؟',a:'من 20 يوم عمل إلى 3 أشهر حسب مكان التقديم وكمال الملف.'}],status:'published',createdAt:new Date(Date.now()-2*3600000).toISOString()},
  {id:'art_jobs_001',slug:'متوسط-الرواتب-اسبانيا-2025',title:'متوسط الرواتب في إسبانيا 2025 — قطاعاً بقطاع',summary:'تعرّف على متوسطات الرواتب في إسبانيا لعام 2025 في مختلف القطاعات وكيف تختلف بين المدن الكبرى.',contentAr:'<h2>الحد الأدنى للأجور 2025</h2><p>رفعت إسبانيا الحد الأدنى للأجور ليصل إلى <strong>1,134 يورو شهرياً</strong> أي 15,876 يورو سنوياً.</p><h2>الرواتب حسب القطاع</h2><h3>التقنية والبرمجة</h3><ul><li>مطور مبتدئ: 25,000 - 35,000 يورو سنوياً</li><li>مطور متوسط: 35,000 - 50,000 يورو سنوياً</li><li>مطور أول: 50,000 - 70,000 يورو سنوياً</li></ul><h3>الضيافة والسياحة</h3><ul><li>نادل: 18,000 - 22,000 يورو سنوياً</li><li>موظف استقبال: 20,000 - 26,000 يورو سنوياً</li></ul><h3>الصحة</h3><ul><li>ممرض: 24,000 - 32,000 يورو سنوياً</li><li>طبيب عام: 35,000 - 50,000 يورو سنوياً</li></ul><h2>أفضل مواقع البحث عن عمل</h2><ul><li>InfoJobs.net — الأكثر شيوعاً</li><li>LinkedIn — للوظائف المتخصصة</li><li>Indeed.es — متنوع وسهل</li></ul>',category:'jobs',image:'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80',tags:['رواتب','عمل','SMI','وظائف'],faq:[{q:'كم الحد الأدنى للراتب 2025؟',a:'1,134 يورو شهرياً أي 15,876 يورو سنوياً موزعة على 14 راتباً.'},{q:'أي قطاع يدفع أكثر؟',a:'قطاع التقنية والبرمجة هو الأعلى أجراً، يليه القطاع الصحي.'}],status:'published',createdAt:new Date(Date.now()-3*3600000).toISOString()},
  {id:'art_housing_001',slug:'ايجار-شقة-اسبانيا-2025',title:'كيف تستأجر شقة في إسبانيا 2025 — دليل العرب الشامل',summary:'كل ما تحتاج معرفته لاستئجار شقة في إسبانيا: الوثائق المطلوبة، متوسط الأسعار في المدن الكبرى، وحقوقك كمستأجر.',contentAr:'<h2>أسعار الإيجار 2025</h2><h3>مدريد</h3><ul><li>استوديو: 900 - 1,300 يورو/شهر</li><li>غرفتان: 1,200 - 1,800 يورو/شهر</li><li>3 غرف: 1,600 - 2,500 يورو/شهر</li></ul><h3>برشلونة</h3><ul><li>استوديو: 900 - 1,400 يورو/شهر</li><li>غرفتان: 1,300 - 2,000 يورو/شهر</li></ul><h3>بلنسية وإشبيلية</h3><ul><li>استوديو: 500 - 750 يورو/شهر</li><li>غرفتان: 700 - 1,100 يورو/شهر</li></ul><h2>الوثائق المطلوبة</h2><ul><li>NIE أو DNI</li><li>عقد العمل أو إثبات الدخل</li><li>آخر 3 نومينا</li></ul><h2>ما تدفعه عند التوقيع</h2><ul><li>تأمين Fianza: شهر إيجار</li><li>ضمان إضافي: حتى شهرين</li><li>شهر مقدم</li></ul><h2>حقوقك كمستأجر</h2><ul><li>مدة العقد الدنيا: 5 سنوات</li><li>زيادة الإيجار مقيدة بنسبة التضخم</li></ul>',category:'housing',image:'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',tags:['إيجار','شقة','سكن','مدريد'],faq:[{q:'كم تحتاج لدفعه عند الاستئجار؟',a:'عادةً 3-4 أشهر إيجار: شهر تأمين + شهر مقدم + ضمان إضافي محتمل.'},{q:'هل يمكن الاستئجار بدون NIE؟',a:'صعب لكن بعض الملاك يقبلون جواز السفر.'}],status:'published',createdAt:new Date(Date.now()-4*3600000).toISOString()},
  {id:'art_edu_001',slug:'تسجيل-الاطفال-في-مدارس-اسبانيا',title:'تسجيل أطفالك في المدارس الإسبانية — كل ما تحتاج معرفته',summary:'دليل شامل لتسجيل الأطفال في المدارس في إسبانيا: التقويم المدرسي، المستندات، وكيفية التعامل مع الحاجز اللغوي.',contentAr:'<h2>النظام التعليمي</h2><p>التعليم في إسبانيا إلزامي ومجاني من سن 6 إلى 16 سنة.</p><ul><li>Educación Primaria: 6-12 سنة</li><li>ESO: 12-16 سنة</li><li>Bachillerato: 16-18 سنة (للجامعة)</li></ul><h2>التسجيلات</h2><p>تفتح عادةً في مارس وأبريل للعام الدراسي القادم.</p><h2>المستندات المطلوبة</h2><ul><li>شهادة الميلاد مترجمة رسمياً</li><li>شهادة التطعيمات</li><li>إثبات الإقامة (Empadronamiento)</li><li>تصريح الإقامة أو NIE</li></ul><h2>أنواع المدارس</h2><ul><li>Colegios Públicos: مجانية تماماً</li><li>Colegios Concertados: رسوم رمزية</li><li>Colegios Privados: 400-2000 يورو/شهر</li></ul><h2>برامج اللغة</h2><p>تقدم المدارس برامج Aulas de Acogida لتعليم الإسبانية للأطفال الجدد.</p>',category:'education',image:'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80',tags:['تعليم','مدارس','أطفال','تسجيل'],faq:[{q:'هل التعليم مجاني للمهاجرين؟',a:'نعم، التعليم الحكومي مجاني لجميع الأطفال بغض النظر عن وضعهم القانوني.'},{q:'هل يحتاج طفلي لمعرفة الإسبانية؟',a:'لا، المدارس تقدم برامج خاصة لتعليم اللغة. الأطفال يندمجون بسرعة.'}],status:'published',createdAt:new Date(Date.now()-5*3600000).toISOString()},
  {id:'art_col_001',slug:'تكلفة-المعيشة-اسبانيا-2025',title:'تكلفة المعيشة في إسبانيا 2025 — كم تحتاج شهرياً؟',summary:'دراسة تفصيلية لتكلفة المعيشة الشهرية في إسبانيا: الإيجار، الطعام، المواصلات، الترفيه وكيف تعيش بميزانية معقولة.',contentAr:'<h2>ميزانية شهرية في مدريد (شخص واحد)</h2><ul><li>الإيجار: 900-1,300 يورو</li><li>المواصلات: 54 يورو</li><li>البقالة: 250-350 يورو</li><li>الكهرباء والإنترنت: 100-150 يورو</li><li>الترفيه: 100-200 يورو</li><li><strong>المجموع: 1,400-2,000 يورو/شهر</strong></li></ul><h2>لعائلة من 4 أفراد</h2><ul><li>الإيجار (3 غرف): 1,500-2,200 يورو</li><li>البقالة: 600-800 يورو</li><li>الخدمات: 150-200 يورو</li><li><strong>المجموع: 2,400-3,500 يورو/شهر</strong></li></ul><h2>أسعار البقالة</h2><ul><li>خبز 500جم: 1.2 يورو</li><li>حليب لتر: 0.9 يورو</li><li>بيض 12 حبة: 2.5 يورو</li><li>دجاجة كاملة: 6-9 يورو</li></ul><h2>نصائح للتوفير</h2><ul><li>تسوّق في Mercadona أو Lidl</li><li>استفد من Menú del día: 10-14 يورو لـ 3 أطباق</li><li>استخدم بنكاً رقمياً مثل Revolut أو N26</li></ul>',category:'cost-of-living',image:'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80',tags:['معيشة','أسعار','ميزانية','نفقات'],faq:[{q:'كم راتب كافٍ للعيش في مدريد؟',a:'للعيش بشكل مريح كشخص أعزب تحتاج 1,800-2,500 يورو صافي.'},{q:'هل إسبانيا أغلى من فرنسا؟',a:'لا، إسبانيا أرخص بنسبة 15-25% من فرنسا وألمانيا.'}],status:'published',createdAt:new Date(Date.now()-6*3600000).toISOString()},
  {id:'art_gov_001',slug:'مزايا-حكومية-اسبانيا-للمقيمين',title:'المزايا والإعانات الحكومية في إسبانيا التي يحق للمقيمين الحصول عليها',summary:'دليل شامل بأهم الإعانات والدعم الحكومي المتاح للمقيمين في إسبانيا: إعانة البطالة، مساعدات الإسكان، والمساعدة الاجتماعية.',contentAr:'<h2>إعانة البطالة (Prestación por Desempleo)</h2><ul><li>تحتاج 12 شهراً اشتراك في الضمان الاجتماعي</li><li>المبلغ: 70% من الراتب للأشهر الـ4 الأولى ثم 50%</li><li>المدة: 4 أشهر إلى 24 شهراً</li><li>التقديم في SEPE خلال 15 يوماً</li></ul><h2>Ingreso Mínimo Vital</h2><ul><li>للشخص المنفرد: حتى 607 يورو/شهر</li><li>للعائلة من 4 أفراد: حتى 1,100 يورو/شهر</li></ul><h2>مساعدات الإسكان</h2><ul><li>الحكومة: حتى 50% من الإيجار لبعض الحالات</li><li>كاتالونيا: منح تصل إلى 2,400 يورو سنوياً</li></ul><h2>الرعاية الصحية</h2><p>جميع المقيمين قانونياً يحق لهم الرعاية الصحية العامة مجاناً عبر أقرب مركز صحي.</p>',category:'government-benefits',image:'https://images.unsplash.com/photo-1532622785990-d2c36a76f5a6?w=800&q=80',tags:['إعانات','دعم حكومي','بطالة','ضمان اجتماعي'],faq:[{q:'هل يحق للأجانب الحصول على إعانة البطالة؟',a:'نعم، إذا كنت تعمل قانونياً وتدفع الاشتراكات لمدة 12 شهراً على الأقل.'},{q:'كيف أتقدم لإعانة الدخل الأدنى؟',a:'إلكترونياً عبر موقع الضمان الاجتماعي أو في أي مكتب Seguridad Social.'}],status:'published',createdAt:new Date(Date.now()-7*3600000).toISOString()},
  {id:'art_news_001',slug:'اسعار-الكهرباء-اسبانيا-2025',title:'أسعار الكهرباء في إسبانيا 2025 — لماذا ارتفعت وكيف تخفض فاتورتك',summary:'ارتفعت أسعار الكهرباء في إسبانيا بشكل ملحوظ. نشرح أسباب هذا الارتفاع وأفضل الطرق العملية لتخفيض الفاتورة الشهرية.',contentAr:'<h2>لماذا ارتفعت أسعار الكهرباء؟</h2><ul><li>ارتفاع أسعار الغاز الطبيعي الأوروبي</li><li>الاعتماد على محطات التوليد التقليدية</li><li>ارتفاع تكاليف نقل الطاقة وصيانة الشبكة</li><li>الضرائب والرسوم الحكومية</li></ul><h2>متوسط الفاتورة الشهرية</h2><ul><li>شقة صغيرة: 50-80 يورو</li><li>شقة متوسطة: 80-130 يورو</li><li>منزل كبير: 150-250 يورو</li></ul><h2>طرق تخفيض الفاتورة</h2><p><strong>1. تعريفة الساعات المتغيرة:</strong> توفر 20-30% إذا استخدمت الأجهزة ليلاً.</p><p><strong>2. الساعات الرخيصة:</strong> منتصف الليل حتى 8 صباحاً وعطلة نهاية الأسبوع.</p><p><strong>3. Bono Social:</strong> خصم حتى 65% للعائلات ذات الدخل المنخفض.</p><p><strong>4. مصابيح LED:</strong> توفر 80% من استهلاك الكهرباء.</p>',category:'local-news',image:'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&q=80',tags:['كهرباء','أسعار','فاتورة','توفير'],faq:[{q:'ما هو Bono Social للكهرباء؟',a:'خصم حكومي يصل إلى 65% على الفاتورة للعائلات ذات الدخل المنخفض.'},{q:'أفضل شركة كهرباء في إسبانيا؟',a:'Iberdrola, Endesa, Naturgy, Holaluz. قارن الأسعار عبر موقع CNMC.'}],status:'published',createdAt:new Date(Date.now()-8*3600000).toISOString()},
  {id:'art_tour_001',slug:'افضل-مدن-اسبانيا-للسياحة-2025',title:'أجمل 10 مدن في إسبانيا تستحق الزيارة في 2025',summary:'من مدريد إلى غرناطة، ومن برشلونة إلى إشبيلية — دليلك الكامل لأجمل المدن الإسبانية وأبرز معالمها السياحية.',contentAr:'<h2>1. مدريد</h2><ul><li>متحف البرادو: من أعظم متاحف الفن في العالم</li><li>بالاسيو ريال: القصر الملكي الأكبر في أوروبا الغربية</li><li>بويرتا ديل سول: قلب مدريد</li><li>حديقة ريتيرو: رئة مدريد الخضراء</li></ul><h2>2. برشلونة</h2><ul><li>Sagrada Família: كاتدرائية غاودي الأيقونية — احجز مسبقاً!</li><li>Park Güell: إطلالات بانورامية رائعة</li><li>لاس رامبلاس: الشارع الشهير</li></ul><h2>3. غرناطة</h2><ul><li>قصر الحمراء: تحفة معمارية إسلامية — احجز مسبقاً!</li><li>حي البيازين: الحي الأندلسي العربي الأصيل</li></ul><h2>4. إشبيلية</h2><ul><li>كاتدرائية إشبيلية: الأكبر في العالم الكاثوليكي</li><li>برج الذهب: رمز المدينة</li></ul><h2>5. بلنسية</h2><ul><li>مدينة الفنون والعلوم: معمار مستقبلي مذهل</li><li>مهرجان La Fallas في مارس</li></ul><h2>نصائح</h2><ul><li>أفضل توقيت: أبريل-يونيو وسبتمبر-أكتوبر</li><li>استخدم قطارات Renfe AVE بين المدن</li></ul>',category:'tourism',image:'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=800&q=80',tags:['سياحة','مدريد','برشلونة','غرناطة','إشبيلية'],faq:[{q:'ما أفضل وقت لزيارة إسبانيا؟',a:'أبريل-يونيو وسبتمبر-أكتوبر: الطقس معتدل والأسعار أقل.'},{q:'كم تكلف زيارة قصر الحمراء؟',a:'حوالي 19 يورو للبالغين. احجز مسبقاً لأن التذاكر تنفد سريعاً.'}],status:'published',createdAt:new Date(Date.now()-9*3600000).toISOString()},
  {id:'art_biz_001',slug:'فتح-شركة-في-اسبانيا-للعرب',title:'كيف تفتح شركتك في إسبانيا — دليل المستثمر العربي',summary:'خطوات عملية وواضحة لفتح شركة في إسبانيا: أنواع الشركات، التكاليف، الإجراءات القانونية، وأفضل القطاعات للاستثمار.',contentAr:'<h2>لماذا إسبانيا؟</h2><ul><li>رابع أكبر اقتصاد في اليورو</li><li>بوابة لأمريكا اللاتينية وأفريقيا</li><li>ضريبة الشركات 25%</li></ul><h2>أنواع الشركات</h2><h3>Autónomo</h3><ul><li>تسجيل سريع في يوم واحد</li><li>اشتراك الضمان الاجتماعي: من 230 يورو/شهر</li></ul><h3>SL (ذات مسؤولية محدودة)</h3><ul><li>رأس مال أدنى: 3,000 يورو</li><li>وقت التأسيس: أسبوعين إلى شهر</li></ul><h2>خطوات التأسيس</h2><p>1. حجز اسم الشركة في السجل التجاري المركزي</p><p>2. فتح حساب بنكي وإيداع رأس المال</p><p>3. توثيق عقد التأسيس أمام كاتب العدل (300-500 يورو)</p><p>4. التسجيل في مصلحة الضرائب والحصول على CIF</p><h2>أفضل القطاعات 2025</h2><ul><li>التقنية والبرمجيات</li><li>الطاقة المتجددة</li><li>السياحة والضيافة</li><li>الخدمات اللوجستية</li></ul>',category:'business',image:'https://images.unsplash.com/photo-1664575198308-3959904fa430?w=800&q=80',tags:['شركة','استثمار','أعمال','SL','ريادة'],faq:[{q:'كم يكلف فتح شركة؟',a:'بين 1,000 و2,500 يورو في الإجراءات، بالإضافة إلى رأس المال 3,000 يورو.'},{q:'هل يمكن للأجانب فتح شركة؟',a:'نعم، تحتاج فقط إلى NIE وجواز سفر ساري.'}],status:'published',createdAt:new Date(Date.now()-10*3600000).toISOString()},
  {id:'art_crime_001',slug:'امان-اسبانيا-للمقيمين-العرب',title:'مدى أمان إسبانيا للمقيمين العرب — حقائق وأرقام',summary:'إسبانيا من أكثر دول العالم أماناً، لكن هناك تحديات يجب معرفتها. دليل عن الأمن في المدن الإسبانية وكيف تحمي نفسك.',contentAr:'<h2>إسبانيا في مؤشرات الأمن</h2><p>إسبانيا ضمن أكثر 30 دولة أماناً في العالم. معدل الجريمة العنيفة منخفض جداً.</p><h2>الجرائم الأكثر شيوعاً</h2><h3>سرقة المتعلقات (Carterismo)</h3><p>خاصةً في محطات المترو والأماكن السياحية المزدحمة.</p><p><strong>الحماية:</strong> ضع محفظتك في الجيب الأمامي، لا تضع هاتفك على الطاولة.</p><h3>الاحتيال الإلكتروني</h3><p>احذر من SMS وهمية ومواقع إيجار شقق مزيفة.</p><h2>أرقام الطوارئ</h2><ul><li>112: الطوارئ العامة</li><li>091: الشرطة الوطنية</li><li>092: الشرطة البلدية</li></ul>',category:'crime-safety',image:'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',tags:['أمان','جريمة','شرطة','إسبانيا'],faq:[{q:'هل إسبانيا آمنة للعرب المسلمين؟',a:'نعم، مجتمع متسامح ويوجد مجتمع مسلم كبير. الجوامع موجودة في معظم المدن.'},{q:'أكثر جريمة شائعة؟',a:'سرقة المتعلقات في المناطق السياحية. الجرائم العنيفة نادرة.'}],status:'published',createdAt:new Date(Date.now()-11*3600000).toISOString()},
  {id:'art_imm_003',slug:'الحصول-على-الجنسية-الاسبانية',title:'كيف تحصل على الجنسية الإسبانية — كل الطرق والشروط',summary:'دليل شامل لطرق الحصول على الجنسية الإسبانية: بالإقامة، الزواج، والنسب — مع الشروط والمدد الزمنية لكل طريقة.',contentAr:'<h2>طرق الحصول على الجنسية</h2><p>الجنسية الإسبانية من أقوى جوازات السفر (100+ دولة بدون فيزا).</p><h2>1. بالإقامة</h2><ul><li>10 سنوات: للحالة العامة (معظم العرب)</li><li>5 سنوات: للاجئين المعترف بهم</li><li>2 سنة: لمواطني أمريكا اللاتينية والبرتغال</li><li>سنة واحدة: للمولودين في إسبانيا أو أبناء الإسبان</li></ul><h2>2. بالزواج</h2><p>بعد سنة واحدة من الزواج القانوني بشرط اجتياز DELE A2 وCCSE.</p><h2>شروط التقديم</h2><ul><li>الإقامة القانونية للمدة المطلوبة</li><li>اجتياز DELE A2 وCCSE</li><li>خلو السجل الجنائي</li></ul><h2>وقت المعالجة</h2><p>من 1 إلى 3 سنوات. التقديم الآن إلكترونياً عبر Registro Civil online.</p>',category:'immigration',image:'https://images.unsplash.com/photo-1580048915913-4f8f5cb481c4?w=800&q=80',tags:['جنسية','إسبانية','جواز سفر','تجنيس'],faq:[{q:'كم سنة إقامة للجنسية الإسبانية؟',a:'للعرب عموماً 10 سنوات. الزواج من إسباني يخفض الشرط إلى سنة واحدة.'},{q:'هل يمكن الاحتفاظ بالجنسية العربية؟',a:'معظم الدول العربية لا تعترف بازدواجية الجنسية. استشر محامياً متخصصاً.'}],status:'published',createdAt:new Date(Date.now()-12*3600000).toISOString()}
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
