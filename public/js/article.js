/* ===================================
   إسبانيا اليوم — article.js v2
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

// Lazy image observer
let imgObserver;
if ('IntersectionObserver' in window) {
  imgObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
          imgObserver.unobserve(img);
        }
      }
    });
  }, { rootMargin: '200px' });
}

function observeImages() {
  if (!imgObserver) return;
  document.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img));
}

function imgUrl(a) {
  return a.image || a.image_url || a.imageUrl || '';
}

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
  const h=document.getElementById('nav-hamburger'), o=document.getElementById('mobile-overlay'),
        p=document.getElementById('mobile-panel'), c=document.getElementById('mobile-close');
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
  const pathParts = window.location.pathname.split('/');
  const pathSlug = pathParts[pathParts.length - 1];
  const params = new URLSearchParams(window.location.search);
  const id = pathSlug || params.get('id') || params.get('slug');

  if (!id || id === 'article') { show404(); return; }

  initReadingProgress();

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

function initReadingProgress() {
  const bar = document.createElement('div');
  bar.id = 'reading-progress';
  bar.style.cssText = 'position:fixed;top:0;right:0;height:3px;background:var(--primary);z-index:9999;width:0%;transition:width 0.1s;';
  document.body.appendChild(bar);
  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = total > 0 ? (window.scrollY / total * 100) + '%' : '0%';
  });
}

function renderArticle(a) {
  const cat = a.category || 'local-news';
  const catLabel = CAT_LABELS[cat] || 'أخبار';
  const catIcon = CAT_ICONS[cat] || '📰';
  const url = window.location.href;
  const title = a.title || a.arabic_title || '';
  const summary = a.summary || a.arabic_summary || a.excerpt || '';
  const content = a.contentAr || a.arabic_content || a.content || '';
  const faq = a.faq || [];
  const slug = a.arabic_slug || a.slug || a.id;
  const canonicalUrl = `${window.location.origin}/article/${slug}`;

  // Set meta
  document.getElementById('page-title').textContent = `${title} | إسبانيا اليوم`;
  document.getElementById('page-desc').setAttribute('content', summary);
  document.getElementById('og-title').setAttribute('content', title);
  document.getElementById('og-desc').setAttribute('content', summary);
  document.getElementById('og-url').setAttribute('content', canonicalUrl);
  const aImg = imgUrl(a);
  if (aImg) document.getElementById('og-img').setAttribute('content', aImg);

  // Canonical
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel='canonical'; document.head.appendChild(canonical); }
  canonical.href = canonicalUrl;

  // Structured data
  const sd = {
    "@context":"https://schema.org","@type":"NewsArticle",
    "headline": title, "description": summary,
    "datePublished": a.createdAt || a.publishedAt,
    "dateModified": a.updatedAt || a.createdAt,
    "author": {"@type":"Organization","name":"إسبانيا اليوم"},
    "publisher": {"@type":"Organization","name":"إسبانيا اليوم",
      "logo":{"@type":"ImageObject","url":`${window.location.origin}/logo.png`},
      "url": window.location.origin},
    "mainEntityOfPage": canonicalUrl,
    "image": aImg || "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"
  };
  if (faq.length) {
    sd["@type"] = ["NewsArticle","FAQPage"];
    sd.mainEntity = faq.map(f=>({
      "@type":"Question","name":f.q||f.question,
      "acceptedAnswer":{"@type":"Answer","text":f.a||f.answer}
    }));
  }
  const sdScript = document.createElement('script');
  sdScript.type = 'application/ld+json';
  sdScript.textContent = JSON.stringify(sd);
  document.head.appendChild(sdScript);

  // Tags
  const tags = a.tags || [];
  const tagsHtml = tags.length
    ? `<div class="tags-wrap">${tags.map(t=>`<a href="/search?q=${encodeURIComponent(t)}" class="tag">#${escHtml(t)}</a>`).join('')}</div>` : '';

  // FAQ
  const faqHtml = faq.length ? `
    <div class="faq-section">
      <h2>أسئلة شائعة</h2>
      ${faq.map((f,i)=>{
        const q = f.q || f.question || '';
        const ans = f.a || f.answer || '';
        return `<div class="faq-item" id="faq-${i}">
          <div class="faq-q" onclick="toggleFaq(${i})">${escHtml(q)}<span class="arrow">▾</span></div>
          <div class="faq-a">${escHtml(ans)}</div>
        </div>`;
      }).join('')}
    </div>` : '';

  const imgHtml = aImg
    ? `<img class="article-hero-img" src="${aImg}" alt="${escHtml(title)}" loading="eager" fetchpriority="high" onerror="this.style.display='none'">`
    : '';

  const viewCount = (a.views || 0).toLocaleString('ar');

  document.getElementById('article-main').innerHTML = `
    <nav class="article-breadcrumb" aria-label="مسار التنقل">
      <a href="/">الرئيسية</a><span>/</span>
      <a href="/category/${cat}">${catLabel}</a><span>/</span>
      <span>${escHtml(title.substring(0,50))}${title.length>50?'...':''}</span>
    </nav>

    <span class="article-cat-badge" style="font-size:12px;margin-bottom:12px;display:inline-block">${catIcon} ${catLabel}</span>
    <h1 class="article-headline">${escHtml(title)}</h1>
    ${summary ? `<p class="article-summary">${escHtml(summary)}</p>` : ''}

    <div class="article-info-bar">
      <span class="info-item"><i class="far fa-calendar"></i> ${formatDate(a.createdAt||a.publishedAt)}</span>
      <span class="info-item"><i class="far fa-clock"></i> ${readTime(a)} دقائق قراءة</span>
      <span class="info-item" id="view-counter"><i class="far fa-eye"></i> ${viewCount} مشاهدة</span>
      <span class="info-item"><i class="fas fa-tag"></i> ${catLabel}</span>
    </div>

    ${imgHtml}

    <!-- AD ZONE 1 — بعد الصورة مباشرة -->
    <div class="ad-label">إعلان</div>
    <div class="ad-zone ad-banner" id="ad-article-top">
      <!-- adsense unit هنا -->
    </div>

    <div class="article-body">${formatContent(content)}</div>

    ${tagsHtml}

    <div class="share-bar">
      <span>شارك المقال:</span>
      <button class="share-btn share-fb" onclick="share('facebook')"><i class="fab fa-facebook-f"></i> فيسبوك</button>
      <button class="share-btn share-wa" onclick="share('whatsapp')"><i class="fab fa-whatsapp"></i> واتساب</button>
      <button class="share-btn share-tw" onclick="share('twitter')"><i class="fab fa-x-twitter"></i> X</button>
      <button class="share-btn share-cp" onclick="copyLink()"><i class="far fa-copy"></i> نسخ</button>
    </div>

    <!-- AD ZONE 2 — بعد المشاركة -->
    <div class="ad-label" style="margin-top:24px">إعلان</div>
    <div class="ad-zone ad-banner" id="ad-article-mid">
      <!-- adsense unit هنا -->
    </div>

    ${faqHtml}

    <!-- AD ZONE 3 — نهاية المقال -->
    <div class="ad-label" style="margin-top:24px">إعلان</div>
    <div class="ad-zone ad-banner" id="ad-article-bottom">
      <!-- adsense unit هنا -->
    </div>
  `;
}

function formatContent(html) {
  if (!html) return '<p>المحتوى غير متاح</p>';
  if (!html.includes('<')) {
    return html.split('\n\n').filter(p=>p.trim()).map(p=>`<p>${escHtml(p.trim())}</p>`).join('');
  }
  return html;
}

function toggleFaq(i) {
  document.getElementById(`faq-${i}`).classList.toggle('open');
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
    const res = await fetch(`/api/articles?limit=6`);
    const data = await res.json();
    const all = (data.articles || data || []);
    // First try same category, then any
    let related = all.filter(a => a.category===cat && (a.arabic_slug||a.slug||a.id) !== currentId).slice(0,3);
    if (related.length < 3) {
      const others = all.filter(a => a.category!==cat && (a.arabic_slug||a.slug||a.id) !== currentId).slice(0, 3-related.length);
      related = [...related, ...others];
    }

    const sidebar = document.getElementById('related-list');
    const relatedGrid = document.getElementById('related-articles-grid');

    // Sidebar list
    if (sidebar) {
      if (!related.length) { sidebar.closest('.widget').style.display='none'; }
      else {
        sidebar.innerHTML = related.map((a,i) => `
          <a href="/article/${a.arabic_slug||a.slug||a.id}" class="most-read-item">
            <div class="most-read-num">${i+1}</div>
            <div>
              <div class="most-read-title">${escHtml(a.title||a.arabic_title)}</div>
              <div style="font-size:11px;color:var(--text-light);margin-top:3px"><i class="far fa-eye"></i> ${(a.views||0).toLocaleString('ar')}</div>
            </div>
          </a>`).join('');
      }
    }

    // Bottom related cards grid
    if (relatedGrid && related.length) {
      const CAT_LABELS_LOCAL = {immigration:'الهجرة',residency:'الإقامة',jobs:'الوظائف',housing:'السكن',education:'التعليم','cost-of-living':'تكلفة المعيشة','government-benefits':'مزايا حكومية','crime-safety':'الأمن والسلامة','local-news':'أخبار محلية',tourism:'السياحة',business:'الأعمال'};
      relatedGrid.innerHTML = related.slice(0,3).map(a => {
        const aImg = a.image || a.image_url || a.imageUrl || '';
        const aC = a.category || 'local-news';
        const imgHtml = aImg
          ? `<img data-src="${aImg}" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" alt="${escHtml(a.title||a.arabic_title)}" class="related-card-img" loading="lazy" onerror="this.style.display='none'">`
          : `<div class="related-card-img-placeholder">${CAT_ICONS[aC]||'📰'}</div>`;
        return `
          <a href="/article/${a.arabic_slug||a.slug||a.id}" class="related-card">
            <div class="related-card-media">${imgHtml}</div>
            <div class="related-card-body">
              <span class="article-cat-badge" style="font-size:11px">${CAT_LABELS_LOCAL[aC]||'أخبار'}</span>
              <div class="related-card-title">${escHtml(a.title||a.arabic_title)}</div>
              <div class="related-card-meta"><i class="far fa-clock"></i> ${readTime(a)} دقائق · <i class="far fa-eye"></i> ${(a.views||0).toLocaleString('ar')}</div>
            </div>
          </a>`;
      }).join('');
      if (imgObserver) {
        relatedGrid.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img));
      }
    }
  } catch {}
}

async function trackView(id) {
  try {
    await fetch(`/api/articles/${id}/view`, {method:'POST'});
    // Update the visible view counter +1
    const counter = document.getElementById('view-counter');
    if (counter) {
      const current = parseInt(counter.textContent.replace(/[^0-9]/g,'')) || 0;
      counter.innerHTML = `<i class="far fa-eye"></i> ${(current+1).toLocaleString('ar')} مشاهدة`;
    }
  } catch {}
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
  const t=a.content||a.contentAr||a.arabic_content||a.body||'';
  return Math.max(2,Math.ceil(t.split(/\s+/).length/200));
}

function showToast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),3000);
}
