/* ═══════════════════════════
   España Hoy — Homepage JS
═══════════════════════════ */

const CATS = {
  immigration:         { ar: 'الهجرة',         icon: '✈️' },
  residency:           { ar: 'الإقامة',         icon: '🏠' },
  jobs:                { ar: 'الوظائف',         icon: '💼' },
  housing:             { ar: 'السكن',           icon: '🏘️' },
  education:           { ar: 'التعليم',         icon: '🎓' },
  'cost-of-living':    { ar: 'تكلفة المعيشة',   icon: '💰' },
  'government-benefits':{ ar: 'المساعدات',      icon: '🤝' },
  'crime-safety':      { ar: 'الأمن',           icon: '🛡️' },
  'local-news':        { ar: 'أخبار محلية',     icon: '📰' },
  tourism:             { ar: 'السياحة',         icon: '🌅' },
  business:            { ar: 'الأعمال',         icon: '📈' }
};

let currentPage = 1;
let currentCategory = null;
let loading = false;
let allLoaded = false;

// ── Helpers ──────────────────────────────────────────
function catLabel(id) { return CATS[id]?.ar || id; }
function catIcon(id)  { return CATS[id]?.icon || '📰'; }
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `${Math.floor(diff/60)} دقيقة`;
  if (diff < 86400) return `${Math.floor(diff/3600)} ساعة`;
  return `${Math.floor(diff/86400)} يوم`;
}
function imgUrl(article) {
  if (article.image_url) return article.image_url;
  const prompt = encodeURIComponent(article.arabic_title || 'Spain news Arabic');
  return `https://image.pollinations.ai/prompt/${prompt}?width=800&height=450&nologo=true&seed=${article.id || 1}`;
}

// ── Categories bar ───────────────────────────────────
function renderCats() {
  const wrap = document.getElementById('catsScroll');
  if (!wrap) return;
  const all = `<button class="cat-chip active" data-cat="" onclick="filterCat(this,'')">🗞️ الكل</button>`;
  const chips = Object.entries(CATS).map(([id, v]) =>
    `<button class="cat-chip" data-cat="${id}" onclick="filterCat(this,'${id}')">${v.icon} ${v.ar}</button>`
  ).join('');
  wrap.innerHTML = all + chips;
}

function filterCat(btn, cat) {
  document.querySelectorAll('.cat-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentCategory = cat || null;
  currentPage = 1;
  allLoaded = false;
  document.getElementById('feedTitle').textContent = cat ? catLabel(cat) : 'آخر الأخبار';
  document.getElementById('articlesGrid').innerHTML = skeletonCards(6);
  fetchArticles(true);
}

// ── Skeleton ─────────────────────────────────────────
function skeletonCards(n) {
  return Array(n).fill(`
    <div class="article-card">
      <div class="card-img-wrap skeleton" style="padding-top:56.25%"></div>
      <div class="card-body">
        <div class="skeleton" style="height:1rem;width:85%;margin-bottom:.5rem;border-radius:6px"></div>
        <div class="skeleton" style="height:1rem;width:60%;border-radius:6px"></div>
      </div>
    </div>`).join('');
}

// ── Article card HTML ─────────────────────────────────
function articleCard(a) {
  return `
    <div class="article-card">
      <div class="card-img-wrap">
        <img src="${imgUrl(a)}" alt="${a.arabic_title}" loading="lazy"
             onerror="this.src='https://image.pollinations.ai/prompt/spain+news+arabic?width=800&height=450&nologo=true&seed=${a.id}'">
        <span class="card-badge">${catIcon(a.category)} ${catLabel(a.category)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">
          <a href="/article/${a.arabic_slug}">${a.arabic_title}</a>
        </h3>
        <p class="card-excerpt">${a.arabic_meta_description || ''}</p>
        <div class="card-meta">
          <span class="views">${(a.views || 0).toLocaleString('ar')}</span>
          <span class="date">${timeAgo(a.created_at)}</span>
        </div>
      </div>
    </div>`;
}

// ── Fetch articles ────────────────────────────────────
async function fetchArticles(reset = false) {
  if (loading || allLoaded) return;
  loading = true;
  const btn = document.getElementById('loadMoreBtn');
  if (btn) btn.disabled = true;

  try {
    const params = new URLSearchParams({ page: currentPage, limit: 12 });
    if (currentCategory) params.set('category', currentCategory);
    const res = await fetch(`/api/articles?${params}`);
    const data = await res.json();
    const grid = document.getElementById('articlesGrid');

    if (reset) grid.innerHTML = '';

    if (!data.articles || data.articles.length === 0) {
      if (reset) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">
        <div style="font-size:3rem">📭</div>
        <p style="margin-top:1rem;font-weight:600">لا توجد مقالات بعد — النظام يعمل على جمع الأخبار</p>
        <p style="font-size:.85rem;margin-top:.5rem">سيتم نشر أول مقال قريباً</p>
      </div>`;
      allLoaded = true;
    } else {
      grid.innerHTML += data.articles.map(articleCard).join('');
      if (currentPage >= data.pages) allLoaded = true;
      else currentPage++;
    }
  } catch (e) {
    console.error('Fetch error:', e);
  }

  loading = false;
  if (btn) btn.disabled = allLoaded;
  if (btn && allLoaded) btn.textContent = 'لا يوجد المزيد';
}

// ── Hero section ──────────────────────────────────────
async function loadHero() {
  try {
    const res = await fetch('/api/articles?page=1&limit=3');
    const data = await res.json();
    if (!data.articles || data.articles.length === 0) {
      renderDefaultHero();
      return;
    }
    const [main, ...sides] = data.articles;
    renderHero(main, sides);
  } catch(e) {
    renderDefaultHero();
  }
}

function renderHero(main, sides) {
  const heroMain = document.getElementById('heroMain');
  heroMain.className = 'hero-main';
  heroMain.innerHTML = `
    <img class="hero-card-img" src="${imgUrl(main)}" alt="${main.arabic_title}" loading="eager">
    <div class="hero-overlay"></div>
    <div class="hero-info">
      <span class="hero-cat-badge">${catIcon(main.category)} ${catLabel(main.category)}</span>
      <h2 class="hero-title"><a href="/article/${main.arabic_slug}" style="color:inherit">${main.arabic_title}</a></h2>
      <div class="hero-meta">${timeAgo(main.created_at)} · ${(main.views||0).toLocaleString('ar')} مشاهدة</div>
    </div>`;

  const heroSide = document.getElementById('heroSide');
  heroSide.innerHTML = sides.slice(0,2).map(a => `
    <div class="hero-side-card">
      <img class="hero-card-img" src="${imgUrl(a)}" alt="${a.arabic_title}" loading="lazy">
      <div class="hero-overlay"></div>
      <div class="hero-info">
        <span class="hero-cat-badge">${catLabel(a.category)}</span>
        <h3 class="hero-title"><a href="/article/${a.arabic_slug}" style="color:inherit">${a.arabic_title}</a></h3>
        <div class="hero-meta">${timeAgo(a.created_at)}</div>
      </div>
    </div>`).join('') || '<div class="hero-side-card skeleton"></div><div class="hero-side-card skeleton"></div>';
}

function renderDefaultHero() {
  document.getElementById('heroMain').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:360px;background:linear-gradient(135deg,var(--navy),var(--red))">
      <div style="text-align:center;color:white;padding:2rem">
        <div style="font-size:3rem;margin-bottom:1rem">🇪🇸</div>
        <h2 style="font-size:1.6rem;font-weight:900;margin-bottom:.5rem">إسبانيا اليوم</div>
        <p style="opacity:.8">منصتك العربية لأخبار إسبانيا</p>
        <p style="opacity:.6;font-size:.85rem;margin-top:.5rem">النظام يعمل على جمع آخر الأخبار...</p>
      </div>
    </div>`;
}

// ── Ticker ────────────────────────────────────────────
async function loadTicker() {
  try {
    const res = await fetch('/api/articles?limit=8&page=1');
    const data = await res.json();
    if (data.articles && data.articles.length > 0) {
      document.getElementById('ticker').innerHTML =
        data.articles.map(a => `<span style="margin-left:4rem">📰 ${a.arabic_title}</span>`).join('');
    }
  } catch(e) {}
}

// ── Popular sidebar ───────────────────────────────────
async function loadPopular() {
  try {
    const res = await fetch('/api/articles?limit=5&page=1');
    const data = await res.json();
    const list = document.getElementById('popularList');
    if (!list) return;
    if (!data.articles || data.articles.length === 0) {
      list.innerHTML = '<p style="font-size:.83rem;color:var(--text-muted);text-align:center;padding:1rem">قريباً...</p>';
      return;
    }
    list.innerHTML = data.articles.map((a, i) => `
      <div class="popular-item">
        <span class="popular-num">${i+1}</span>
        <a href="/article/${a.arabic_slug}" class="popular-title">${a.arabic_title}</a>
      </div>`).join('');
  } catch(e) {}
}

// ── Burger menu ───────────────────────────────────────
document.getElementById('burger')?.addEventListener('click', () => {
  const nav = document.getElementById('mainNav');
  nav.classList.toggle('open');
});

// ── Load More ─────────────────────────────────────────
document.getElementById('loadMoreBtn')?.addEventListener('click', () => fetchArticles());

// ── Init ──────────────────────────────────────────────
(async () => {
  renderCats();
  document.getElementById('articlesGrid').innerHTML = skeletonCards(6);
  await Promise.all([loadHero(), fetchArticles(), loadTicker(), loadPopular()]);
})();
