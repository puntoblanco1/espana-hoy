/* ════════════════════════════
   España Hoy — Category JS
════════════════════════════ */

const CATS = {
  immigration:           { ar: 'الهجرة',          icon: '✈️', desc: 'كل ما يخص الهجرة إلى إسبانيا — الإجراءات، الوثائق، والتجارب الحقيقية.' },
  residency:             { ar: 'الإقامة',          icon: '🏠', desc: 'دليلك الشامل للحصول على الإقامة في إسبانيا وتجديدها.' },
  jobs:                  { ar: 'الوظائف',          icon: '💼', desc: 'فرص العمل، الرواتب، وكيفية إيجاد وظيفة في إسبانيا.' },
  housing:               { ar: 'السكن',            icon: '🏘️', desc: 'أسعار الإيجار، شراء العقارات، وأفضل الأحياء للعرب.' },
  education:             { ar: 'التعليم',          icon: '🎓', desc: 'المدارس والجامعات الإسبانية وكيفية التسجيل فيها.' },
  'cost-of-living':      { ar: 'تكلفة المعيشة',   icon: '💰', desc: 'تكلفة الحياة اليومية في إسبانيا — طعام، مواصلات، ترفيه.' },
  'government-benefits': { ar: 'المساعدات',        icon: '🤝', desc: 'الدعم الحكومي والمزايا الاجتماعية المتاحة للمقيمين.' },
  'crime-safety':        { ar: 'الأمن والسلامة',   icon: '🛡️', desc: 'تقارير الأمن وأكثر المدن أماناً للعائلات العربية.' },
  'local-news':          { ar: 'أخبار محلية',      icon: '📰', desc: 'آخر الأخبار الإسبانية المترجمة والمحللة للقارئ العربي.' },
  tourism:               { ar: 'السياحة',          icon: '🌅', desc: 'أجمل الوجهات السياحية في إسبانيا ودليل السفر.' },
  business:              { ar: 'الأعمال',          icon: '📈', desc: 'فرص الاستثمار وتأسيس الشركات في إسبانيا.' }
};

let currentPage = 1;
let currentCat  = null;
let loading     = false;
let allLoaded   = false;

function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 3600)  return `${Math.floor(s/60)} دقيقة`;
  if (s < 86400) return `${Math.floor(s/3600)} ساعة`;
  return `${Math.floor(s/86400)} يوم`;
}
function imgUrl(a) {
  if (a.image_url) return a.image_url;
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(a.arabic_title||'Spain')}?width=800&height=450&nologo=true&seed=${a.id||1}`;
}

// ── Render category hero ─────────────────────────────
function renderHero(cat) {
  const info = CATS[cat] || { ar: 'أخبار إسبانيا', icon: '📰', desc: 'آخر أخبار إسبانيا للعرب.' };
  document.getElementById('catIcon').textContent  = info.icon;
  document.getElementById('catTitle').textContent = info.ar;
  document.getElementById('catDesc').textContent  = info.desc;
  document.getElementById('pageTitle').textContent = `${info.ar} | إسبانيا اليوم`;
  document.getElementById('metaDesc').content     = info.desc;
  document.getElementById('ogTitle').content      = `${info.ar} | إسبانيا اليوم`;
  document.getElementById('feedTitle').textContent = `مقالات ${info.ar}`;

  // highlight active nav
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.href.includes(cat));
  });
}

// ── Category chips ───────────────────────────────────
function renderCatChips(active) {
  const wrap = document.getElementById('catsScroll');
  wrap.innerHTML = `<a href="/" class="cat-chip">🗞️ الكل</a>` +
    Object.entries(CATS).map(([id, v]) =>
      `<a href="/category/${id}" class="cat-chip${id===active?' active':''}">${v.icon} ${v.ar}</a>`
    ).join('');
}

// ── Sidebar categories list ──────────────────────────
async function renderSidebarCats() {
  const el = document.getElementById('catsList');
  try {
    const res  = await fetch('/api/stats');
    const data = await res.json();
    const counts = {};
    (data.categories || []).forEach(c => { counts[c.category] = c.n; });
    el.innerHTML = Object.entries(CATS).map(([id, v]) => `
      <div class="popular-item">
        <span class="popular-num">${v.icon}</span>
        <div style="flex:1">
          <a href="/category/${id}" class="popular-title">${v.ar}</a>
          <div style="font-size:.72rem;color:var(--text-light)">${counts[id]||0} مقال</div>
        </div>
      </div>`).join('');
  } catch(e) { el.innerHTML = ''; }
}

// ── Skeleton ─────────────────────────────────────────
function skeletons(n) {
  return Array(n).fill(`
    <div class="article-card">
      <div class="card-img-wrap skeleton" style="padding-top:56.25%"></div>
      <div class="card-body">
        <div class="skeleton" style="height:1rem;width:85%;margin-bottom:.5rem;border-radius:6px"></div>
        <div class="skeleton" style="height:1rem;width:60%;border-radius:6px"></div>
      </div>
    </div>`).join('');
}

// ── Article card ─────────────────────────────────────
function card(a) {
  const cat = CATS[a.category] || { ar: a.category, icon: '📰' };
  return `
    <div class="article-card">
      <div class="card-img-wrap">
        <img src="${imgUrl(a)}" alt="${a.arabic_title}" loading="lazy"
             onerror="this.src='https://image.pollinations.ai/prompt/spain+news?width=800&height=450&nologo=true'">
        <span class="card-badge">${cat.icon} ${cat.ar}</span>
      </div>
      <div class="card-body">
        <h3 class="card-title"><a href="/article/${a.arabic_slug}">${a.arabic_title}</a></h3>
        <p class="card-excerpt">${a.arabic_meta_description||''}</p>
        <div class="card-meta">
          <span class="views">${(a.views||0).toLocaleString('ar')}</span>
          <span class="date">${timeAgo(a.created_at)}</span>
        </div>
      </div>
    </div>`;
}

// ── Fetch articles ────────────────────────────────────
async function fetchArticles(reset = false) {
  if (loading || allLoaded) return;
  loading = true;
  const btn  = document.getElementById('loadMoreBtn');
  const grid = document.getElementById('articlesGrid');
  if (btn) btn.disabled = true;

  try {
    const params = new URLSearchParams({ page: currentPage, limit: 12 });
    if (currentCat) params.set('category', currentCat);
    const res  = await fetch(`/api/articles?${params}`);
    const data = await res.json();

    if (reset) grid.innerHTML = '';

    if (!data.articles || data.articles.length === 0) {
      if (reset) grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:4rem;color:var(--text-muted)">
          <div style="font-size:4rem">📭</div>
          <h3 style="margin-top:1rem">لا توجد مقالات في هذا التصنيف بعد</h3>
          <p style="margin-top:.5rem;font-size:.9rem">النظام يعمل على جمع الأخبار — عد قريباً!</p>
          <a href="/" style="display:inline-block;margin-top:1.5rem;background:var(--red);color:white;padding:.7rem 2rem;border-radius:999px;font-weight:700">العودة للرئيسية</a>
        </div>`;
      allLoaded = true;
    } else {
      grid.innerHTML += data.articles.map(card).join('');
      document.getElementById('totalCount').textContent = `${data.total} مقال`;
      document.getElementById('catCount').textContent   = `${data.total} مقال`;
      if (currentPage >= data.pages) allLoaded = true;
      else currentPage++;
    }
  } catch(e) { console.error(e); }

  loading = false;
  if (btn) { btn.disabled = allLoaded; if (allLoaded) btn.textContent = 'لا يوجد المزيد'; }
}

// ── Init ──────────────────────────────────────────────
(async () => {
  const slug = window.location.pathname.split('/category/')[1] || '';
  currentCat = slug || null;

  renderHero(slug);
  renderCatChips(slug);
  renderSidebarCats();

  document.getElementById('articlesGrid').innerHTML = skeletons(6);
  await fetchArticles(true);

  document.getElementById('loadMoreBtn')?.addEventListener('click', () => fetchArticles());
  document.getElementById('burger')?.addEventListener('click', () => {
    document.getElementById('mainNav')?.classList.toggle('open');
  });
})();
