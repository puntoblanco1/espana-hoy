/* ===================================
   إسبانيا اليوم — app.js
   Homepage JavaScript
   =================================== */

const API_BASE = '';
const CAT_LABELS = {
  immigration: 'الهجرة', residency: 'الإقامة', jobs: 'الوظائف',
  housing: 'السكن', education: 'التعليم', 'cost-of-living': 'تكلفة المعيشة',
  'government-benefits': 'مزايا حكومية', 'crime-safety': 'الأمن والسلامة',
  'local-news': 'أخبار محلية', tourism: 'السياحة', business: 'الأعمال'
};
const CAT_ICONS = {
  immigration:'✈️', residency:'📋', jobs:'💼', housing:'🏠',
  education:'📚', 'cost-of-living':'💰', 'government-benefits':'🏛️',
  'crime-safety':'🛡️', 'local-news':'📰', tourism:'🗺️', business:'💹'
};

let allArticles = [];
let displayedCount = 0;
let currentCat = 'all';
const PAGE_SIZE = 9;

function imgUrl(a) {
  return a.image || a.image_url || a.imageUrl || '';
}

document.addEventListener('DOMContentLoaded', () => {
  setDateTime();
  setInterval(setDateTime, 60000);
  document.getElementById('year').textContent = new Date().getFullYear();
  initDarkMode();
  initMobileNav();
  initBackTop();
  initSearch();
  fetchArticles();
});

function setDateTime() {
  const now = new Date();
  const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  document.getElementById('current-date').textContent =
    `${days[now.getDay()]}، ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  document.getElementById('current-time').textContent = `${h}:${m}`;
}

function initDarkMode() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateDarkIcon(saved);
  document.getElementById('dark-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateDarkIcon(next);
  });
}
function updateDarkIcon(theme) {
  document.getElementById('dark-toggle').innerHTML =
    theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function initMobileNav() {
  const hamburger = document.getElementById('nav-hamburger');
  const overlay = document.getElementById('mobile-overlay');
  const panel = document.getElementById('mobile-panel');
  const closeBtn = document.getElementById('mobile-close');
  const openNav = () => { overlay.classList.add('open'); panel.classList.add('open'); document.body.style.overflow='hidden'; };
  const closeNav = () => { overlay.classList.remove('open'); panel.classList.remove('open'); document.body.style.overflow=''; };
  hamburger.addEventListener('click', openNav);
  overlay.addEventListener('click', closeNav);
  closeBtn.addEventListener('click', closeNav);
}

function initBackTop() {
  const btn = document.getElementById('back-top');
  window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 400));
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function initSearch() {
  document.getElementById('search-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
}
function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (q) window.location.href = `/search?q=${encodeURIComponent(q)}`;
}

async function fetchArticles() {
  try {
    const res = await fetch('/api/articles?limit=60&status=published');
    const data = await res.json();
    allArticles = (data.articles || data || []).filter(a => a.status === 'published' || a.title);
    if (allArticles.length === 0) { showEmptyState(); return; }
    renderHero();
    renderArticleGrid();
    renderMostRead();
    renderTicker();
    renderCategoryCounts();
  } catch (e) {
    console.error('Error fetching articles:', e);
    showEmptyState();
  }
}

function renderHero() {
  const heroCard = document.getElementById('hero-card');
  const sideCards = document.getElementById('side-cards');
  if (!allArticles.length) return;

  const hero = allArticles[0];
  const cat = hero.category || 'local-news';
  const catLabel = CAT_LABELS[cat] || 'أخبار';
  const slug = hero.arabic_slug || hero.slug || hero.id;
  const img = imgUrl(hero);
  const imageHtml = img
    ? `<img class="hero-img" src="${img}" alt="${escHtml(hero.title || hero.arabic_title)}" loading="eager" onerror="this.style.display='none'">`
    : `<div class="hero-placeholder"></div>`;

  const title = hero.title || hero.arabic_title || '';
  heroCard.innerHTML = `
    ${imageHtml}
    <div class="hero-content">
      <div class="hero-cat">${catLabel}</div>
      <h1 class="hero-title">${escHtml(title)}</h1>
      <div class="hero-meta">
        <span><i class="far fa-clock"></i> ${formatDate(hero.createdAt || hero.publishedAt)}</span>
        <span><i class="far fa-eye"></i> ${hero.views || 0} مشاهدة</span>
      </div>
    </div>`;
  heroCard.onclick = () => window.location.href = `/article/${slug}`;
  heroCard.style.cursor = 'pointer';

  const sides = allArticles.slice(1, 3);
  sideCards.innerHTML = sides.map(a => {
    const c = a.category || 'local-news';
    const aImg = imgUrl(a);
    const imgHtml = aImg
      ? `<img class="side-card-img" src="${aImg}" alt="${escHtml(a.title||a.arabic_title)}" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="side-card-img-placeholder">${CAT_ICONS[c] || '📰'}</div>`;
    return `
      <a href="/article/${a.arabic_slug||a.slug||a.id}" class="side-card">
        ${imgHtml}
        <div class="side-card-body">
          <div class="side-card-cat">${CAT_LABELS[c] || 'أخبار'}</div>
          <div class="side-card-title">${escHtml(a.title||a.arabic_title)}</div>
          <div class="side-card-date">${formatDate(a.createdAt || a.publishedAt)}</div>
        </div>
      </a>`;
  }).join('');
}

function renderArticleGrid(reset = true) {
  const grid = document.getElementById('article-grid');
  const filtered = currentCat === 'all'
    ? allArticles.slice(3)
    : allArticles.filter(a => (a.category || '') === currentCat);

  if (reset) { displayedCount = 0; grid.innerHTML = ''; }

  const slice = filtered.slice(displayedCount, displayedCount + PAGE_SIZE);
  displayedCount += slice.length;

  if (slice.length === 0 && displayedCount === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-light)">لا توجد مقالات في هذا التصنيف بعد</div>`;
    return;
  }

  slice.forEach(a => {
    const cat = a.category || 'local-news';
    const catLabel = CAT_LABELS[cat] || 'أخبار';
    const aImg = imgUrl(a);
    const imgHtml = aImg
      ? `<img class="article-card-thumb" src="${aImg}" alt="${escHtml(a.title||a.arabic_title)}" loading="lazy" onerror="this.style.display='none'">`
      : `<div class="article-card-thumb-placeholder">${CAT_ICONS[cat] || '📰'}</div>`;
    const card = document.createElement('a');
    card.className = 'article-card';
    card.href = `/article/${a.arabic_slug||a.slug||a.id}`;
    card.innerHTML = `
      ${imgHtml}
      <div class="article-card-body">
        <span class="article-cat-badge">${catLabel}</span>
        <h2 class="article-card-title">${escHtml(a.title||a.arabic_title)}</h2>
        <p class="article-card-summary">${escHtml((a.summary||a.arabic_summary||'').substring(0,100))}...</p>
        <div class="article-card-meta">
          <span>${formatDate(a.createdAt || a.publishedAt)}</span>
          <span class="article-read-time"><i class="far fa-clock"></i> ${readTime(a)} دقائق</span>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  const btn = document.getElementById('load-more');
  btn.style.display = filtered.slice(displayedCount).length > 0 ? 'inline-flex' : 'none';
}

document.getElementById('load-more').addEventListener('click', () => renderArticleGrid(false));

document.getElementById('cat-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.cat-tab');
  if (!tab) return;
  document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  currentCat = tab.dataset.cat;
  renderArticleGrid(true);
});

function renderMostRead() {
  const list = document.getElementById('most-read-list');
  const top5 = [...allArticles].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5);
  list.innerHTML = top5.map((a, i) => `
    <a href="/article/${a.arabic_slug||a.slug||a.id}" class="most-read-item">
      <div class="most-read-num">${i + 1}</div>
      <div class="most-read-title">${escHtml(a.title||a.arabic_title)}</div>
    </a>`).join('');
}

function renderTicker() {
  const track = document.getElementById('ticker-track');
  const recent = allArticles.slice(0, 8);
  if (!recent.length) return;
  const items = [...recent, ...recent];
  track.innerHTML = items.map(a =>
    `<span class="ticker-item" onclick="window.location.href='/article/${a.arabic_slug||a.slug||a.id}'" style="cursor:pointer">${escHtml(a.title||a.arabic_title)}</span>`
  ).join('');
  // Reset animation
  track.style.animation = 'none';
  track.offsetHeight;
  track.style.animation = '';
}

function renderCategoryCounts() {
  const counts = {};
  allArticles.forEach(a => {
    const c = a.category || 'local-news';
    counts[c] = (counts[c] || 0) + 1;
  });
  Object.entries(counts).forEach(([cat, count]) => {
    const el = document.getElementById(`cnt-${cat}`);
    if (el) el.textContent = count;
  });
}

function subscribeNewsletter() {
  const email = document.getElementById('newsletter-email').value.trim();
  if (!email || !email.includes('@')) { showToast('أدخل بريداً إلكترونياً صحيحاً'); return; }
  showToast('شكراً! تم تسجيلك في النشرة الإخبارية ✅');
  document.getElementById('newsletter-email').value = '';
}

function showEmptyState() {
  document.getElementById('hero-card').innerHTML = `
    <div class="hero-placeholder"></div>
    <div class="hero-content">
      <div class="hero-cat">إسبانيا اليوم</div>
      <h1 class="hero-title">مرحباً بك في إسبانيا اليوم</h1>
      <div class="hero-meta"><span>جاري تحميل أحدث الأخبار...</span></div>
    </div>`;
  document.getElementById('article-grid').innerHTML =
    `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-light)">
      <div style="font-size:48px;margin-bottom:16px">📰</div>
      <p style="font-size:16px">سيتم نشر المقالات قريباً</p>
     </div>`;
  document.getElementById('load-more').style.display = 'none';
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const months = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                    'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const diff = Math.floor((Date.now() - d) / 60000);
    if (diff < 60) return `منذ ${diff} دقيقة`;
    if (diff < 1440) return `منذ ${Math.floor(diff/60)} ساعة`;
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch { return ''; }
}

function readTime(article) {
  const text = article.content || article.contentAr || article.arabic_content || article.body || '';
  return Math.max(2, Math.ceil(text.split(/\s+/).length / 200));
}

function showToast(msg, dur = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), dur);
}
