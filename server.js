const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = '/tmp';
const DB_PATH = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify({ articles: [] }));

let db = { articles: [] };
try {
  db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
} catch (e) { console.error('DB read error:', e); }

function saveDB() {
  try { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); } 
  catch (e) { console.error('DB save error:', e); }
}

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  next();
});

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', articles: db.articles.length });
});

app.get('/api/articles', (req, res) => res.json(db.articles));

app.get('/api/articles/:slug', (req, res) => {
  const article = db.articles.find(a => a.slug === req.params.slug);
  article ? res.json(article) : res.status(404).json({ error: 'Not found' });
});

app.post('/api/fix-articles', (req, res) => {
  if (db.articles.length === 0) {
    db.articles = [
      {
        id: '1', slug: 'spain-minimum-wage-2024',
        title: 'بشرى للعاملين في إسبانيا: رفع الحد الأدنى للأجور إلى 1134 يورو',
        category: 'Jobs', excerpt: 'خبر سار لكل العاملين في إسبانيا! 🇪🇸 زيادة رسمية في الحد الأدنى للأجور.',
        image: 'https://image.pollinations.ai/prompt/Spain%20minimum%20wage%20euro?width=800&height=400&nologo=true',
        createdAt: new Date().toISOString(), status: 'published', facebookPublished: true
      },
      {
        id: '2', slug: 'spain-cheap-cities-2026',
        title: 'وداعاً لغلاء مدريد: أرخص 5 مدن للسكن في إسبانيا 2026',
        category: 'Housing', excerpt: 'هل أسعار مدريد وبرشلونة صدمتك؟ اكتشف 5 مدن سرية بإيجارات رخيصة!',
        image: 'https://image.pollinations.ai/prompt/Spain%20cheap%20cities%20housing?width=800&height=400&nologo=true',
        createdAt: new Date().toISOString(), status: 'published', facebookPublished: true
      },
      {
        id: '3', slug: 'spain-digital-nomad-visa',
        title: 'تأشيرة النوماد الرقمي في إسبانيا 2026: كل ما تحتاجه',
        category: 'Immigration', excerpt: '2300 يورو فقط شهرياً للحصول على إقامة إسبانيا كnomad رقمي!',
        image: 'https://image.pollinations.ai/prompt/Spain%20digital%20nomad%20visa%20laptop?width=800&height=400&nologo=true',
        createdAt: new Date().toISOString(), status: 'published', facebookPublished: false
      }
    ];
    saveDB();
    res.json({ success: true, count: 3 });
  } else {
    res.json({ success: true, count: db.articles.length, message: 'Already exists' });
  }
});

app.get('/sitemap.xml', (req, res) => {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += '  <url><loc>https://espana-hoy-production-9f6e.up.railway.app/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n';
  db.articles.forEach(a => {
    xml += `  <url><loc>https://espana-hoy-production-9f6e.up.railway.app/article/${a.slug}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
  });
  xml += '</urlset>';
  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow: /webhook/\nAllow: /\nSitemap: https://espana-hoy-production-9f6e.up.railway.app/sitemap.xml');
});

// Static files
app.use(express.static(PUBLIC_DIR));

// Fallback to index.html for all other routes
app.get('*', (req, res) => {
  const filePath = req.path.startsWith('/article/') ? 'article.html' : 'index.html';
  res.sendFile(path.join(PUBLIC_DIR, filePath));
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on port ${PORT}, articles: ${db.articles.length}`));
