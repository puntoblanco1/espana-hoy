/* ===================================
   إسبانيا اليوم — article.js
   =================================== */

const CAT_LABELS = {
  immigration:'الهجرة', residency:'الإقامة', jobs:'الوظائف', housing:'السكن',
  education:'التعليم', 'cost-of-living':'تكلفة المعيشة',
  'government-benefits':'مزايا حكومية', 'crime-safety':'الأمن والسلامة',
  'local-news':'أخبار محلية', tourism:'السياحة', business:'الأعمال'
};

document.addEventListener('DOMContentLoaded', () => {
  setDate();
  initDarkMode();
  initMobileNav();
  initBackTop();
  initSearch();
  document.getElementById('year').textContent = new Date().getFullYear();
  loadArticle();
});

function setDate() {
  const d = new Date();
  const months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  document.getElementById('current-date').textContent =
    `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function initDarkMode() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateDarkIcon(saved);
  document.getElementById('dark-toggle').addEventListener('click', () => {
    const c = document.documentElement.getAttribute('data-theme');
    const n = c === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', n);
    localStorage.setItem('theme', n);
    updateDarkIcon(n);
  });
}
function updateDarkIcon(t) {
  document.getElementById('dark-toggle').innerHTML = t==='dark'?'<i class="fas fa-sun"></i>':'<i class="fas fa-moon"></i>';
}

function initMobileNav() {
  const h=document.getElementById('nav-hamburger'), o=document.getElementById('mobile-overlay'), p=document.getElementById('mobile-panel'), c=document.getElementById('mobile-close');
  const open=()=>{o.classList.add('open');p.classList.add('open');document.body.style.overflow='hidden';};
  const close=()=>{o.classList.remove('open');p.classList.remove('open');document.body.style.overflow='';};
  h.addEventListener('click',open); o.addEventListener('click',close); c.addEventListener('click',close);
}

function initBackTop() {
  const b=document.getElementById('back-top');
  window.addEventListener('scroll',()=>b.classList.toggle('visible',window.scrollY>400));
  b.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
}

function initSearch() {
  document.getElementById('search-input').addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});
}
function doSearch() {
  const q=document.getElementById('search-input').value.trim();
  if(q) window.location.href=`/search?q=${encodeURIComponent(q)}`;
}

async function loadArticle() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id') || params.get('slug');
  if (!id) { show404(); return; }

  try {
    const res = await fetch(`/api/articles/${id}`);
    if (!res.ok) throw new Error('not found');
    const article = await res.json();
    renderArticle(article);
    trackView(id);
    fetchRelated(article.category, id);
  } catch(e) {
    show404();
  }
}

function renderArticle(a) {
  const cat = a.category || 'local-news';
  const catLabel = CAT_LABELS[cat] || 'أخبار';
  const url = window.location.href;
  const title = a.title || '';
  const summary = a.summary || a.excerpt || '';
  const content = a.contentAr || a.content || '';
  const faq = a.faq || [];

  // Set meta
  document.getElementById('page-title').textContent = `${title} | إسبانيا اليوم`;
  document.getElementById('page-desc').setAttribute('content', summary);
  document.getElementById('og-title').setAttribute('content', title);
  document.getElementById('og-desc').setAttribute('content', summary);
  document.getElementById('og-url').setAttribute('content', url);
  if (a.image) document.getElementById('og-img').setAttribute('content', a.image);

  // Structured data for article
  const sd = {
    "@context":"https://schema.org",
    "@type":"NewsArticle",
    "headline": title,
    "description": summary,
    "datePublished": a.createdAt || a.publishedAt,
    "dateModified": a.updatedAt || a.createdAt,
    "author": {"@type":"Organization","name":"إسبانيا اليوم"},
    "publisher": {"@type":"Organization","name":"إسبانيا اليوم","url":"https://espana-hoy-production.up.railway.app"},
    "mainEntityOfPage": url,
    "image": a.image || ""
  };
  const sdScript = document.createElement('script');
  sdScript.type = 'application/ld+json';
  sdScript.textContent = JSON.stringify(sd);
  document.head.appendChild(sdScript);

  // Tags
  const tags = a.tags || [];
  const tagsHtml = tags.length
    ? `<div class="tags-wrap">${tags.map(t=>`<span class="tag">#${escHtml(t)}</span>`).join('')}</div>` : '';

  // FAQ
  const faqHtml = faq.length ? `
    <div class="faq-section">
      <h2>أسئلة شائعة</h2>
      ${faq.map((f,i)=>`
        <div class="faq-item" id="faq-${i}">
          <div class="faq-q" onclick="toggleFaq(${i})">${escHtml(f.q || f.question)}<span class="arrow">▾</span></div>
          <div class="faq-a">${escHtml(f.a || f.answer)}</div>
        </div>`).join('')}
    </div>` : '';

  const imgHtml = a.image
    ? `<img class="article-hero-img" src="${a.image}" alt="${escHtml(title)}" loading="eager">`
    : '';

  document.getElementById('article-main').innerHTML = `
    <nav class="article-breadcrumb" aria-label="مسار التنقل">
      <a href="/">الرئيسية</a><span>/</span>
      <a href="/category/${cat}">${catLabel}</a><span>/</span>
      <span>${title.substring(0,50)}${title.length>50?'...':''}</span>
    </nav>

    <span class="article-cat-badge" style="font-size:12px;margin-bottom:12px;display:inline-block">${catLabel}</span>
    <h1 class="article-headline">${escHtml(title)}</h1>
    ${summary ? `<p class="article-summary">${escHtml(summary)}</p>` : ''}

    <div class="article-info-bar">
      <span class="info-item"><i class="far fa-calendar"></i> ${formatDate(a.createdAt||a.publishedAt)}</span>
      <span class="info-item"><i class="far fa-clock"></i> ${readTime(a)} دقائق قراءة</span>
      <span class="info-item"><i class="far fa-eye"></i> ${a.views||0} مشاهدة</span>
      <span class="info-item"><i class="fas fa-tag"></i> ${catLabel}</span>
    </div>

    ${imgHtml}

    <div class="ad-label">إعلان</div>
    <div class="ad-zone ad-banner" style="margin-bottom:24px"></div>

    <div class="article-body">${formatContent(content)}</div>

    ${tagsHtml}

    <div class="share-bar">
      <span>شارك:</span>
      <button class="share-btn share-fb" onclick="share('facebook')"><i class="fab fa-facebook-f"></i> فيسبوك</button>
      <button class="share-btn share-wa" onclick="share('whatsapp')"><i class="fab fa-whatsapp"></i> واتساب</button>
      <button class="share-btn share-tw" onclick="share('twitter')"><i class="fab fa-x-twitter"></i> X</button>
      <button class="share-btn share-cp" onclick="copyLink()"><i class="far fa-copy"></i> نسخ الرابط</button>
    </div>

    ${faqHtml}

    <div class="ad-label" style="margin-top:24px">إعلان</div>
    <div class="ad-zone ad-banner"></div>
  `;
}

function formatContent(html) {
  if (!html) return '<p>المحتوى غير متاح</p>';
  // If it's plain text, convert newlines to paragraphs
  if (!html.includes('<')) {
    return html.split('\n\n').filter(p=>p.trim()).map(p=>`<p>${escHtml(p.trim())}</p>`).join('');
  }
  return html;
}

function toggleFaq(i) {
  const item = document.getElementById(`faq-${i}`);
  item.classList.toggle('open');
}

function share(platform) {
  const url = encodeURIComponent(window.location.href);
  const title = encodeURIComponent(document.getElementById('page-title').textContent);
  const urls = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    whatsapp: `https://api.whatsapp.com/send?text=${title}%20${url}`,
    twitter: `https://twitter.com/intent/tweet?url=${url}&text=${title}`
  };
  window.open(urls[platform], '_blank', 'width=600,height=400');
}

function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => showToast('تم نسخ الرابط ✅'));
}

async function fetchRelated(cat, currentId) {
  try {
    const res = await fetch(`/api/articles?category=${cat}&limit=5`);
    const data = await res.json();
    const articles = (data.articles || data || []).filter(a => (a.slug||a.id) !== currentId).slice(0,5);
    const list = document.getElementById('related-list');
    if (!articles.length) { list.closest('.widget').style.display='none'; return; }
    list.innerHTML = articles.map((a,i) => `
      <a href="/article?id=${a.slug||a.id}" class="most-read-item">
        <div class="most-read-num">${i+1}</div>
        <div class="most-read-title">${escHtml(a.title)}</div>
      </a>`).join('');
  } catch {}
}

async function trackView(id) {
  try { await fetch(`/api/articles/${id}/view`, {method:'POST'}); } catch {}
}

function show404() {
  document.getElementById('article-main').innerHTML = `
    <div style="text-align:center;padding:80px 20px">
      <div style="font-size:72px;margin-bottom:20px">📰</div>
      <h1 style="font-size:28px;margin-bottom:12px">المقال غير موجود</h1>
      <p style="color:var(--text-light);margin-bottom:24px">ربما تم حذف المقال أو تغيير رابطه</p>
      <a href="/" style="background:var(--primary);color:white;padding:12px 28px;border-radius:40px;font-weight:700;text-decoration:none">العودة للرئيسية</a>
    </div>`;
}

function subscribeNewsletter() {
  const e=document.getElementById('newsletter-email').value.trim();
  if(!e||!e.includes('@')){showToast('أدخل بريداً إلكترونياً صحيحاً');return;}
  showToast('شكراً! تم تسجيلك ✅');
  document.getElementById('newsletter-email').value='';
}

function escHtml(str) {
  if(!str)return'';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(ds) {
  if(!ds)return'';
  try {
    const d=new Date(ds);
    const months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const diff=Math.floor((Date.now()-d)/60000);
    if(diff<60)return`منذ ${diff} دقيقة`;
    if(diff<1440)return`منذ ${Math.floor(diff/60)} ساعة`;
    return`${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }catch{return'';}
}

function readTime(a) {
  const t=(a.content||a.contentAr||a.body||'');
  return Math.max(2,Math.ceil(t.split(/\s+/).length/200));
}

function showToast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}
