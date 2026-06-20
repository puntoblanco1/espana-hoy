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
    injectSchema(article);
    trackView(id);
    fetchRelated(article.category, id);
    renderUsefulLinks(article.category);
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
      <button class="share-btn share-wa" onclick="share('whatsapp')"><i class="fab fa-whatsapp"></i> واتساب</button>
      <button class="share-btn share-fb" onclick="share('facebook')"><i class="fab fa-facebook-f"></i> فيسبوك</button>
      <button class="share-btn share-tw" onclick="share('twitter')"><i class="fab fa-x-twitter"></i> X</button>
      <button class="share-btn share-tg" onclick="share('telegram')"><i class="fab fa-telegram"></i> تيليجرام</button>
      <button class="share-btn share-cp" onclick="copyLink()"><i class="far fa-copy"></i> نسخ</button>
    </div>

    <div class="share-cta-block">
      <div class="share-cta-icon">📢</div>
      <div class="share-cta-text">
        <strong>هل أفادك هذا المقال؟</strong>
        <p>شاركه مع العرب في إسبانيا — ممكن يساعد شخصاً يبحث عن هذه المعلومة الآن</p>
      </div>
      <div class="share-cta-btns">
        <button class="share-cta-btn wa" onclick="share('whatsapp')"><i class="fab fa-whatsapp"></i> شارك على واتساب</button>
        <button class="share-cta-btn fb" onclick="share('facebook')"><i class="fab fa-facebook-f"></i> شارك على فيسبوك</button>
        <button class="share-cta-btn tg" onclick="share('telegram')"><i class="fab fa-telegram"></i> تيليجرام</button>
        <button class="share-cta-btn cp" onclick="copyLink()"><i class="far fa-copy"></i> نسخ الرابط</button>
      </div>
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
    whatsapp: `https://api.whatsapp.com/send?text=${title}%0A%0A${url}`,
    twitter:  `https://twitter.com/intent/tweet?url=${url}&text=${title}`,
    telegram: `https://t.me/share/url?url=${url}&text=${title}`
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


/* ===== Useful Links by Category ===== */
const USEFUL_LINKS = {
  housing: {
    title: '🏠 ابحث عن سكن في إسبانيا',
    links: [
      { name: 'Idealista', desc: 'أكبر موقع عقارات في إسبانيا', icon: '🏡', url: 'https://www.idealista.com' },
      { name: 'Fotocasa', desc: 'شقق وعقارات للإيجار والبيع', icon: '🔑', url: 'https://www.fotocasa.es' },
      { name: 'Pisos.com', desc: 'آلاف العروض العقارية', icon: '🏢', url: 'https://www.pisos.com' },
      { name: 'Habitaclia', desc: 'عقارات في كتالونيا والبلنسية', icon: '🏘️', url: 'https://www.habitaclia.com' },
    ]
  },
  jobs: {
    title: '💼 ابحث عن عمل في إسبانيا',
    links: [
      { name: 'InfoJobs', desc: 'أكبر بوابة وظائف في إسبانيا', icon: '💼', url: 'https://www.infojobs.net' },
      { name: 'LinkedIn España', desc: 'فرص عمل وتواصل مهني', icon: '🔗', url: 'https://www.linkedin.com/jobs' },
      { name: 'Indeed España', desc: 'ملايين الوظائف في إسبانيا', icon: '🔍', url: 'https://es.indeed.com' },
      { name: 'Trabaja con nosotros', desc: 'وظائف في الإدارة الإسبانية', icon: '🏛️', url: 'https://www.sepe.es/HomeSepe/que-es-el-sepe/trabajar-en-el-sepe.html' },
    ]
  },
  immigration: {
    title: '✈️ موارد الهجرة',
    links: [
      { name: 'Extranjería', desc: 'إجراءات الإقامة الرسمية', icon: '📋', url: 'https://www.inclusion.gob.es/web/migraciones/en-tramites/extranjeria' },
      { name: 'Sede Electrónica', desc: 'الموقع الإلكتروني للحكومة', icon: '🖥️', url: 'https://sede.administracionespublicas.gob.es' },
      { name: 'Cita Previa', desc: 'حجز موعد إداري', icon: '📅', url: 'https://sede.administracionespublicas.gob.es/icpplus' },
      { name: 'Policia.es', desc: 'الشرطة الوطنية — NIE وجوازات', icon: '🔵', url: 'https://www.policia.es/nie.html' },
    ]
  },
  residency: {
    title: '📋 الإقامة والوثائق',
    links: [
      { name: 'Extranjería', desc: 'إجراءات الإقامة الرسمية', icon: '📋', url: 'https://www.inclusion.gob.es/web/migraciones/en-tramites/extranjeria' },
      { name: 'Cita Previa NIE', desc: 'حجز موعد للـ NIE', icon: '📅', url: 'https://sede.administracionespublicas.gob.es/icpplus' },
      { name: 'Empadronamiento', desc: 'تسجيل الإقامة في البلدية', icon: '🏠', url: 'https://www.padron.gob.es' },
      { name: 'Consulado Árabe', desc: 'قنصليات الدول العربية', icon: '🌍', url: 'https://www.exteriores.gob.es' },
    ]
  },
  education: {
    title: '📚 التعليم في إسبانيا',
    links: [
      { name: 'Ministerio Educación', desc: 'وزارة التعليم الإسبانية', icon: '🏫', url: 'https://www.educacion.gob.es' },
      { name: 'Cervantes.es', desc: 'تعلم الإسبانية مجاناً', icon: '📖', url: 'https://www.cervantes.es' },
      { name: 'Universidad.es', desc: 'دليل الجامعات الإسبانية', icon: '🎓', url: 'https://www.universidad.es' },
      { name: 'Becas MEC', desc: 'المنح الدراسية الحكومية', icon: '💰', url: 'https://www.becaseducacion.gob.es' },
    ]
  },
  'cost-of-living': {
    title: '💰 تكلفة المعيشة',
    links: [
      { name: 'Numbeo España', desc: 'مقارنة تكاليف المعيشة', icon: '📊', url: 'https://www.numbeo.com/cost-of-living/country_result.jsp?country=Spain' },
      { name: 'OCU', desc: 'منظمة حماية المستهلك', icon: '🛡️', url: 'https://www.ocu.org' },
      { name: 'Idealo Supermercados', desc: 'مقارنة أسعار السوبرماركت', icon: '🛒', url: 'https://www.idealo.es' },
      { name: 'Mercadona Online', desc: 'تسوق من Mercadona', icon: '🏪', url: 'https://www.mercadona.es' },
    ]
  },
  'government-benefits': {
    title: '🏛️ المزايا الحكومية',
    links: [
      { name: 'SEPE', desc: 'الخدمة العامة للتشغيل', icon: '🏛️', url: 'https://www.sepe.es' },
      { name: 'Seguridad Social', desc: 'الضمان الاجتماعي', icon: '🛡️', url: 'https://www.seg-social.es' },
      { name: 'IMSERSO', desc: 'مزايا كبار السن والعجز', icon: '👴', url: 'https://www.imserso.es' },
      { name: 'Hacienda', desc: 'مصلحة الضرائب — تقديم الإقرار', icon: '📄', url: 'https://www.agenciatributaria.es' },
    ]
  },
  'crime-safety': {
    title: '🛡️ الأمن والسلامة',
    links: [
      { name: 'Policía Nacional', desc: 'الشرطة الوطنية الإسبانية', icon: '🔵', url: 'https://www.policia.es' },
      { name: 'Guardia Civil', desc: 'الحرس المدني', icon: '🟢', url: 'https://www.guardiacivil.es' },
      { name: 'Emergencias 112', desc: 'رقم الطوارئ الأوروبي', icon: '🚨', url: 'https://www.112.es' },
      { name: 'Denuncias Online', desc: 'تقديم شكوى إلكترونية', icon: '📝', url: 'https://denuncias.policia.es' },
    ]
  },
  tourism: {
    title: '🗺️ السياحة في إسبانيا',
    links: [
      { name: 'Spain.info', desc: 'الموقع السياحي الرسمي', icon: '🌍', url: 'https://www.spain.info/ar' },
      { name: 'Booking España', desc: 'احجز فندقك في إسبانيا', icon: '🏨', url: 'https://www.booking.com/country/es.ar.html' },
      { name: 'Renfe Trenes', desc: 'حجز تذاكر القطار', icon: '🚄', url: 'https://www.renfe.com' },
      { name: 'Google Maps España', desc: 'خرائط وأماكن سياحية', icon: '🗺️', url: 'https://maps.google.com' },
    ]
  },
  'local-news': {
    title: '📰 مصادر الأخبار',
    links: [
      { name: 'El País', desc: 'أكبر صحيفة إسبانية', icon: '📰', url: 'https://elpais.com' },
      { name: 'El Mundo', desc: 'أخبار إسبانيا والعالم', icon: '🌐', url: 'https://www.elmundo.es' },
      { name: 'RTVE Noticias', desc: 'التلفزيون والراديو الإسباني', icon: '📺', url: 'https://www.rtve.es/noticias' },
      { name: 'El Confidencial', desc: 'أخبار اقتصادية وسياسية', icon: '📊', url: 'https://www.elconfidencial.com' },
    ]
  },
  business: {
    title: '💹 الأعمال في إسبانيا',
    links: [
      { name: 'Autónomos RETA', desc: 'تسجيل العمل الحر', icon: '💼', url: 'https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/Afiliacion/10548' },
      { name: 'Crea tu empresa', desc: 'تأسيس شركة في إسبانيا', icon: '🏢', url: 'https://www.creatuempresa.org' },
      { name: 'Cámaras de Comercio', desc: 'غرفة التجارة الإسبانية', icon: '🤝', url: 'https://www.camara.es' },
      { name: 'ICEX España', desc: 'فرص التجارة والاستثمار', icon: '📈', url: 'https://www.icex.es' },
    ]
  }
};

function renderUsefulLinks(cat) {
  const data = USEFUL_LINKS[cat];
  if (!data) return;

  // === Sidebar Widget ===
  const widget = document.getElementById('useful-links-widget');
  const titleEl = document.getElementById('useful-links-title');
  const bodyEl = document.getElementById('useful-links-body');
  if (widget && titleEl && bodyEl) {
    titleEl.textContent = data.title;
    bodyEl.innerHTML = data.links.map(l => `
      <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="useful-link-item">
        <div class="useful-link-icon">${l.icon}</div>
        <div class="useful-link-text">
          <div class="useful-link-name">${l.name}</div>
          <div class="useful-link-desc">${l.desc}</div>
        </div>
        <i class="fas fa-external-link-alt useful-link-arrow"></i>
      </a>`).join('');
    widget.style.display = '';
  }

  // === End of Article Block ===
  const articleMain = document.getElementById('article-main');
  if (!articleMain) return;
  const existing = document.getElementById('article-resources-block');
  if (existing) return; // already rendered

  const block = document.createElement('div');
  block.id = 'article-resources-block';
  block.className = 'article-resources';
  block.innerHTML = `
    <div class="article-resources-title">
      <i class="fas fa-link"></i> روابط مفيدة — ${data.title}
    </div>
    <div class="article-resources-grid">
      ${data.links.map(l => `
        <a href="${l.url}" target="_blank" rel="noopener noreferrer" class="resource-card">
          <span class="resource-card-icon">${l.icon}</span>
          <span>${l.name}</span>
        </a>`).join('')}
    </div>`;

  // Insert before the share bar (after article body)
  const shareBar = articleMain.querySelector('.share-bar');
  if (shareBar) {
    shareBar.parentNode.insertBefore(block, shareBar);
  }
}


/* ===== Schema.org JSON-LD Injection ===== */
function injectSchema(a) {
  const title   = a.title || a.arabic_title || '';
  const summary = a.summary || a.arabic_summary || '';
  const content = a.content || a.contentAr || a.arabic_content || '';
  const image   = a.image || a.image_url || a.imageUrl || '';
  const cat     = a.category || 'local-news';
  const catLabel = CAT_LABELS[cat] || 'أخبار';
  const slug    = a.arabic_slug || a.slug || a.id;
  const url     = `https://espaniaalyoum.com/article/${slug}`;
  const datePublished = a.createdAt || a.publishedAt || new Date().toISOString();
  const dateModified  = a.updatedAt || datePublished;

  // Strip HTML tags for plain text word count
  const plainText = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const wordCount = plainText.split(' ').filter(Boolean).length;

  // 1. NewsArticle schema
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": title,
    "description": summary,
    "articleBody": plainText.substring(0, 500),
    "wordCount": wordCount,
    "url": url,
    "mainEntityOfPage": { "@type": "WebPage", "@id": url },
    "datePublished": datePublished,
    "dateModified": dateModified,
    "author": {
      "@type": "Organization",
      "name": "فريق التحرير — إسبانيا اليوم",
      "url": "https://espaniaalyoum.com/about"
    },
    "publisher": {
      "@type": "Organization",
      "name": "إسبانيا اليوم | España Hoy",
      "url": "https://espaniaalyoum.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://espaniaalyoum.com/favicon.ico",
        "width": 60,
        "height": 60
      }
    },
    "inLanguage": "ar",
    "articleSection": catLabel,
    "keywords": (a.tags || []).join(', ')
  };
  if (image) {
    articleSchema.image = {
      "@type": "ImageObject",
      "url": image,
      "width": 800,
      "height": 450
    };
  }
  const schemaEl = document.getElementById('schema-article');
  if (schemaEl) schemaEl.textContent = JSON.stringify(articleSchema);

  // 2. BreadcrumbList schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "الرئيسية", "item": "https://espaniaalyoum.com" },
      { "@type": "ListItem", "position": 2, "name": catLabel, "item": `https://espaniaalyoum.com/category/${cat}` },
      { "@type": "ListItem", "position": 3, "name": title, "item": url }
    ]
  };
  const breadcrumbEl = document.getElementById('schema-breadcrumb');
  if (breadcrumbEl) breadcrumbEl.textContent = JSON.stringify(breadcrumbSchema);

  // 3. FAQPage schema — only if article has FAQ
  const faqs = a.faq || a.faqs || [];
  if (faqs.length > 0) {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(f => ({
        "@type": "Question",
        "name": f.q || f.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": f.a || f.answer
        }
      }))
    };
    const faqEl = document.getElementById('schema-faq');
    if (faqEl) faqEl.textContent = JSON.stringify(faqSchema);
  }
}

/* ===== Floating Share Bar ===== */
function initFloatShare() {
  const bar = document.getElementById('float-share');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    bar.classList.toggle('visible', window.scrollY > 300);
  }, { passive: true });
}
document.addEventListener('DOMContentLoaded', initFloatShare);
