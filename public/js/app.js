/* ═══════════════════════════
   España Hoy — Homepage JS
═══════════════════════════ */

const CATS = {
  immigration:          { ar: 'الهجرة',          icon: '✈️' },
  residency:            { ar: 'الإقامة',          icon: '🏠' },
  jobs:                 { ar: 'الوظائف',          icon: '💼' },
  housing:              { ar: 'السكن',            icon: '🏘️' },
  education:            { ar: 'التعليم',          icon: '🎓' },
  'cost-of-living':     { ar: 'تكلفة المعيشة',   icon: '💰' },
  'government-benefits':{ ar: 'المساعدات',        icon: '🤝' },
  'crime-safety':       { ar: 'الأمن',            icon: '🛡️' },
  'local-news':         { ar: 'أخبار محلية',      icon: '📰' },
  tourism:              { ar: 'السياحة',          icon: '🌅' },
  business:             { ar: 'الأعمال',          icon: '📈' }
};

// Fallback images per category
const CAT_IMAGES = {
  immigration:          'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80',
  residency:            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
  jobs:                 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=800&q=80',
  housing:              'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80',
  education:            'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800&q=80',
  'cost-of-living':     'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=80',
  'government-benefits':'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80',
  'crime-safety':       'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&q=80',
  'local-news':         'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=800&q=80',
  tourism:              'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=800&q=80',
  business:             'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80'
};

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80';

let currentPage = 1;
let currentCategory = null;
let loading = false;
let allLoaded = false;

function catLabel(id) { return CATS[id]?.ar || id; }
function catIcon(id)  { return CATS[id]?.icon || '📰'; }

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)    return 'الآن';
  if (diff < 3600)  return `${Math.floor(diff/60)} دقيقة`;
  if (diff < 86400) return `${Math.floor(diff/3600)} ساعة`;
  return `${Math.floor(diff/86400)} يوم`;
}

function imgUrl(article) {
  if (article.image_url && article.image_url.startsWith('http')) return article.image_url;
  return CAT_IMAGES[article.category] || DEFAULT_IMG;
}

// ── Categories bar ─────────────────────────────────────
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

// ── Skeleton ───────────────────────────────────────────
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

// ── Article card ───────────────────────────────────────
function articleCard(a) {
  if (!a.arabic_title || !a.arabic_slug) return '';
  const img = imgUrl(a);
  return `
    <div class="article-card">
      <div class="card-img-wrap">
        <img src="${img}" alt="${a.arabic_title}" loading="lazy"
             onerror="this.src='${CAT_IMAGES[a.category]||DEFAULT_IMG}'">
        <span class="card-badge">${catIcon(a.category)} ${catLabel(a.category)}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title">
          <a href="/article/${a.arabic_slug}">${a.arabic_title}</a>
        </h3>
        <p class="card-excerpt">${a.arabic_meta_description || ''}</p>
        <div class="card-meta">
          <span class="views">${(a.views||0).toLocaleString('ar')}</span>
          <span class="date">${timeAgo(a.created_at)}</span>
        </div>
      </div>
    </div>`;
}

// ── Fetch articles ─────────────────────────────────────
async function fetchArticles(reset = false) {
  if (loading || allLoaded) return;
  loading = true;
  const btn = document.getElementById('loadMoreBtn');
  if (btn) btn.disabled = true;

  try {
    const params = new URLSearchParams({ page: currentPage, limit: 12 });
    if (currentCategory) params.set('category', currentCategory);
    const res  = await fetch(`/api/articles?${params}`);
    const data = await res.json();
    const grid = document.getElementById('articlesGrid');

    if (reset) grid.innerHTML = '';

    const valid = (data.articles || []).filter(a => a.arabic_title && a.arabic_slug);

    if (valid.length === 0) {
      if (reset) grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted)">
          <div style="font-size:3rem">📭</div>
          <p style="margin-top:1rem;font-weight:600">لا توجد مقالات بعد — النظام يعمل على جمع الأخبار</p>
        </div>`;
      allLoaded = true;
    } else {
      grid.innerHTML += valid.map(articleCard).join('');
      if (currentPage >= data.pages) allLoaded = true;
      else currentPage++;
    }
  } catch(e) { console.error(e); }

  loading = false;
  if (btn) { btn.disabled = allLoaded; if (allLoaded) btn.textContent = 'لا يوجد المزيد'; }
}

// ── Hero section ───────────────────────────────────────
async function loadHero() {
  try {
    const res  = await fetch('/api/articles?page=1&limit=5');
    const data = await res.json();
    const valid = (data.articles || []).filter(a => a.arabic_title && a.arabic_slug);
    if (valid.length === 0) { renderDefaultHero(); return; }
    renderHero(valid[0], valid.slice(1, 3));
  } catch(e) { renderDefaultHero(); }
}

function heroCardHtml(a, isMain) {
  const img = imgUrl(a);
  const titleSize = isMain ? '1.4rem' : '.95rem';
  return `
    <img class="hero-card-img" src="${img}" alt="${a.arabic_title}"
         loading="${isMain?'eager':'lazy'}"
         onerror="this.src='${CAT_IMAGES[a.category]||DEFAULT_IMG}'">
    <div class="hero-overlay"></div>
    <div class="hero-info">
      <span class="hero-cat-badge">${catIcon(a.category)} ${catLabel(a.category)}</span>
      <${isMain?'h2':'h3'} class="hero-title" style="font-size:${titleSize}">
        <a href="/article/${a.arabic_slug}" style="color:inherit">${a.arabic_title}</a>
      </${isMain?'h2':'h3'}>
      <div class="hero-meta">${timeAgo(a.created_at)} · ${(a.views||0).toLocaleString('ar')} مشاهدة</div>
    </div>`;
}

function renderHero(main, sides) {
  const heroMain = document.getElementById('heroMain');
  heroMain.className = 'hero-main';
  heroMain.innerHTML = heroCardHtml(main, true);

  const heroSide = document.getElementById('heroSide');
  if (sides.length > 0) {
    heroSide.innerHTML = sides.map(a => `
      <div class="hero-side-card">${heroCardHtml(a, false)}</div>
    `).join('');
  } else {
    heroSide.innerHTML = `
      <div class="hero-side-card" style="background:var(--navy);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);font-size:.9rem">قريباً...</div>
      <div class="hero-side-card" style="background:var(--navy);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.4);font-size:.9rem">قريباً...</div>`;
  }
}

function renderDefaultHero() {
  document.getElementById('heroMain').innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:360px;background:linear-gradient(135deg,var(--navy),var(--red))">
      <div style="text-align:center;color:white;padding:2rem">
        <div style="font-size:4rem">🇪🇸</div>
        <h2 style="font-size:1.6rem;font-weight:900;margin:.75rem 0 .5rem">إسبانيا اليوم</h2>
        <p style="opacity:.7">النظام يعمل على جمع آخر الأخبار...</p>
      </div>
    </div>`;
  document.getElementById('heroSide').innerHTML = `
    <div class="hero-side-card" style="background:linear-gradient(135deg,#C0272D,#9B1F24);display:flex;align-items:center;justify-content:center">
      <div style="text-align:center;color:white;padding:1rem"><div style="font-size:2rem">💼</div><p style="font-size:.85rem;margin-top:.5rem">وظائف إسبانيا</p></div>
    </div>
    <div class="hero-side-card" style="background:linear-gradient(135deg,#1A2744,#243157);display:flex;align-items:center;justify-content:center">
      <div style="text-align:center;color:white;padding:1rem"><div style="font-size:2rem">🏠</div><p style="font-size:.85rem;margin-top:.5rem">سكن وإقامة</p></div>
    </div>`;
}

// ── Ticker ─────────────────────────────────────────────
async function loadTicker() {
  try {
    const res  = await fetch('/api/articles?limit=10&page=1');
    const data = await res.json();
    const valid = (data.articles||[]).filter(a => a.arabic_title);
    if (valid.length > 0) {
      document.getElementById('ticker').innerHTML =
        valid.map(a => `<span style="margin-left:4rem">📰 ${a.arabic_title}</span>`).join('');
    }
  } catch(e) {}
}

// ── Popular sidebar ────────────────────────────────────
async function loadPopular() {
  const list = document.getElementById('popularList');
  if (!list) return;
  try {
    const res  = await fetch('/api/articles?limit=5&page=1');
    const data = await res.json();
    const valid = (data.articles||[]).filter(a => a.arabic_title && a.arabic_slug);
    if (valid.length === 0) {
      list.innerHTML = '<p style="font-size:.83rem;color:var(--text-muted);text-align:center;padding:1rem">قريباً...</p>';
      return;
    }
    list.innerHTML = valid.map((a, i) => `
      <div class="popular-item">
        <span class="popular-num">${i+1}</span>
        <a href="/article/${a.arabic_slug}" class="popular-title">${a.arabic_title}</a>
      </div>`).join('');
  } catch(e) { list.innerHTML = ''; }
}

// ── Burger ─────────────────────────────────────────────
document.getElementById('burger')?.addEventListener('click', () => {
  document.getElementById('mainNav')?.classList.toggle('open');
});

// ── Load More ──────────────────────────────────────────
document.getElementById('loadMoreBtn')?.addEventListener('click', () => fetchArticles());

// ── Init ───────────────────────────────────────────────
(async () => {
  renderCats();
  document.getElementById('articlesGrid').innerHTML = skeletonCards(6);
  await Promise.all([loadHero(), fetchArticles(), loadTicker(), loadPopular()]);
})();
