
// ✅ Helper: never use "MISSING" arabic_slug
function getArticleSlug(a) {
  const s = a.arabic_slug;
  if (s && s !== 'MISSING' && s.length > 3) return s;
  return a.slug || a.id;
}

/* ===================================
   إسبانيا اليوم — category.js
   =================================== */

const CAT_LABELS = {
  immigration:'الهجرة', residency:'الإقامة', jobs:'الوظائف', housing:'السكن',
  education:'التعليم', 'cost-of-living':'تكلفة المعيشة',
  'government-benefits':'مزايا حكومية', 'crime-safety':'الأمن والسلامة',
  'local-news':'أخبار محلية', tourism:'السياحة', business:'الأعمال'
};
const CAT_ICONS = {
  immigration:'✈️', residency:'📋', jobs:'💼', housing:'🏠',
  education:'📚', 'cost-of-living':'💰', 'government-benefits':'🏛️',
  'crime-safety':'🛡️', 'local-news':'📰', tourism:'🗺️', business:'💹'
};
const CAT_DESC = {
  immigration:'آخر أخبار وتحديثات قوانين الهجرة إلى إسبانيا',
  residency:'كل ما يخص بطاقات الإقامة والتجديد والجنسية',
  jobs:'فرص العمل والرواتب وحقوق العمال في إسبانيا',
  housing:'أسعار الإيجار والعقارات والسكن في إسبانيا',
  education:'التعليم والمدارس والجامعات والمنح الدراسية',
  'cost-of-living':'تكلفة المعيشة والأسعار في إسبانيا',
  'government-benefits':'الإعانات والمزايا الحكومية للمقيمين',
  'crime-safety':'أخبار الأمن والسلامة ونصائح الوقاية',
  'local-news':'أخبار المدن والمناطق الإسبانية المختلفة',
  tourism:'السياحة والأماكن والتجارب في إسبانيا',
  business:'ريادة الأعمال والاستثمار والأعمال التجارية'
};

let articles = [];
let displayedCount = 0;
const PAGE_SIZE = 9;
let currentCat = '';

document.addEventListener('DOMContentLoaded', () => {
  setDate();
  initDarkMode();
  initMobileNav();
  initBackTop();
  initSearch();
  document.getElementById('year').textContent = new Date().getFullYear();

  // Get category from URL path e.g. /category/immigration
  const path = window.location.pathname;
  const match = path.match(/\/category\/([^\/]+)/);
  currentCat = match ? match[1] : 'local-news';

  updateCatUI();
  fetchCategoryArticles();
});

function setDate() {
  const d=new Date(), months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  document.getElementById('current-date').textContent=`${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function initDarkMode() {
  const saved=localStorage.getItem('theme')||'light';
  document.documentElement.setAttribute('data-theme',saved);
  updateDarkIcon(saved);
  document.getElementById('dark-toggle').addEventListener('click',()=>{
    const c=document.documentElement.getAttribute('data-theme'),n=c==='dark'?'light':'dark';
    document.documentElement.setAttribute('data-theme',n);localStorage.setItem('theme',n);updateDarkIcon(n);
  });
}
function updateDarkIcon(t){document.getElementById('dark-toggle').innerHTML=t==='dark'?'<i class="fas fa-sun"></i>':'<i class="fas fa-moon"></i>';}

function initMobileNav() {
  const h=document.getElementById('nav-hamburger'),o=document.getElementById('mobile-overlay'),p=document.getElementById('mobile-panel'),c=document.getElementById('mobile-close');
  const open=()=>{o.classList.add('open');p.classList.add('open');document.body.style.overflow='hidden';};
  const close=()=>{o.classList.remove('open');p.classList.remove('open');document.body.style.overflow='';};
  h.addEventListener('click',open);o.addEventListener('click',close);c.addEventListener('click',close);
}

function initBackTop(){
  const b=document.getElementById('back-top');
  window.addEventListener('scroll',()=>b.classList.toggle('visible',window.scrollY>400));
  b.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
}

function initSearch(){
  document.getElementById('search-input').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
}
function doSearch(){const q=document.getElementById('search-input').value.trim();if(q)window.location.href=`/search?q=${encodeURIComponent(q)}`;}

function updateCatUI() {
  const label = CAT_LABELS[currentCat] || currentCat;
  const icon = CAT_ICONS[currentCat] || '📰';
  const desc = CAT_DESC[currentCat] || '';
  document.getElementById('page-title').textContent = `${label} | إسبانيا اليوم`;
  document.getElementById('page-desc').setAttribute('content', desc);
  document.getElementById('cat-title').textContent = label;
  document.getElementById('cat-icon').textContent = icon;
  document.getElementById('cat-desc').textContent = desc;
  document.getElementById('cat-breadcrumb').textContent = label;

  // Highlight active nav link
  document.querySelectorAll('.nav-menu .nav-item > a').forEach(a => {
    if (a.href.includes(`/category/${currentCat}`)) a.classList.add('active');
  });
}

async function fetchCategoryArticles() {
  try {
    // Reuse server-rendered data if available — avoids duplicate fetch
    if (window.__SSR_CATEGORY__ && window.__SSR_CATEGORY__.category === currentCat) {
      articles = window.__SSR_CATEGORY__.articles || [];
      displayedCount = Math.min(9, articles.length); // first 9 already rendered server-side
      const btn = document.getElementById('load-more');
      if (btn) btn.style.display = articles.slice(displayedCount).length > 0 ? 'inline-flex' : 'none';
      return;
    }
    const res = await fetch(`/api/articles?category=${currentCat}&limit=60&status=published`);
    const data = await res.json();
    articles = data.articles || data || [];
    renderGrid(true);
  } catch(e) {
    showEmpty();
  }
}

function renderGrid(reset=true) {
  const grid = document.getElementById('cat-article-grid');
  if (reset) { displayedCount=0; grid.innerHTML=''; }

  const slice = articles.slice(displayedCount, displayedCount + PAGE_SIZE);
  displayedCount += slice.length;

  if (slice.length===0 && displayedCount===0) { showEmpty(); return; }

  slice.forEach(a => {
    const cat = a.category || currentCat;
    const icon = CAT_ICONS[cat] || '📰';
    const imgHtml = a.image
      ? `<img class="article-card-thumb" src="${a.image}" alt="${escHtml(a.title)}" loading="lazy">`
      : `<div class="article-card-thumb-placeholder">${icon}</div>`;
    const card = document.createElement('a');
    card.className = 'article-card';
    card.href = `/article/${getArticleSlug(a)}`;
    card.innerHTML = `
      ${imgHtml}
      <div class="article-card-body">
        <span class="article-cat-badge">${CAT_LABELS[cat]||'أخبار'}</span>
        <h2 class="article-card-title">${escHtml(a.title)}</h2>
        <div class="article-card-meta">
          <span>${formatDate(a.createdAt||a.publishedAt)}</span>
          <span class="article-read-time"><i class="far fa-clock"></i> ${readTime(a)} دقائق</span>
        </div>
      </div>`;
    grid.appendChild(card);
  });

  const btn = document.getElementById('load-more');
  btn.style.display = articles.slice(displayedCount).length > 0 ? 'inline-flex' : 'none';
}

document.getElementById('load-more').addEventListener('click',()=>renderGrid(false));

function showEmpty() {
  document.getElementById('cat-article-grid').innerHTML=`
    <div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-light)">
      <div style="font-size:48px;margin-bottom:16px">${CAT_ICONS[currentCat]||'📰'}</div>
      <p style="font-size:16px">لا توجد مقالات في هذا التصنيف بعد</p>
      <a href="/" style="display:inline-block;margin-top:16px;background:var(--primary);color:white;padding:10px 24px;border-radius:40px;font-weight:700;text-decoration:none">العودة للرئيسية</a>
    </div>`;
  document.getElementById('load-more').style.display='none';
}

function subscribeNewsletter(){
  const e=document.getElementById('newsletter-email').value.trim();
  if(!e||!e.includes('@')){showToast('أدخل بريداً إلكترونياً صحيحاً');return;}
  showToast('شكراً! تم تسجيلك ✅');
  document.getElementById('newsletter-email').value='';
}

function escHtml(s){if(!s)return'';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function formatDate(ds){
  if(!ds)return'';
  try{const d=new Date(ds),months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],diff=Math.floor((Date.now()-d)/60000);
  if(diff<60)return`منذ ${diff} دقيقة`;if(diff<1440)return`منذ ${Math.floor(diff/60)} ساعة`;
  return`${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;}catch{return'';}
}
function readTime(a){return Math.max(2,Math.ceil((a.content||a.contentAr||'').split(/\s+/).length/200));}
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3000);}

