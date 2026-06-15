/* ════════════════════════════
   España Hoy — Article JS
════════════════════════════ */

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

const CAT_IMAGES = {
  immigration:          'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80',
  residency:            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80',
  jobs:                 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=1200&q=80',
  housing:              'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80',
  education:            'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&q=80',
  'cost-of-living':     'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=1200&q=80',
  'government-benefits':'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=80',
  'crime-safety':       'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&q=80',
  'local-news':         'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1200&q=80',
  tourism:              'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=1200&q=80',
  business:             'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80'
};

const DEFAULT_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80';

let currentArticle = null;
let currentLang    = 'ar';

function catLabel(id) { return CATS[id]?.ar || id; }
function catIcon(id)  { return CATS[id]?.icon || '📰'; }

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 3600)  return `${Math.floor(diff/60)} دقيقة`;
  if (diff < 86400) return `${Math.floor(diff/3600)} ساعة`;
  return `${Math.floor(diff/86400)} يوم`;
}

function imgUrl(a) {
  if (a.image_url && a.image_url.startsWith('http') && !a.image_url.includes('pollinations')) return a.image_url;
  return CAT_IMAGES[a.category] || DEFAULT_IMG;
}

function parseContent(text) {
  if (!text) return '';
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, m => `<ul>${m}</ul>`)
    .split(/\n\n+/)
    .map(p => p.startsWith('<') ? p : `<p>${p}</p>`)
    .join('');
}

function parseFAQ(text) {
  if (!text) return [];
  const pairs = [];
  const parts = text.split(/(?=س:|Q:)/g).filter(Boolean);
  for (const part of parts) {
    const qMatch = part.match(/[سQ]:\s*(.+?)(?:\n|ج:|A:)/s);
    const aMatch = part.match(/[جA]:\s*(.+)/s);
    if (qMatch && aMatch) pairs.push({ q: qMatch[1].trim(), a: aMatch[1].trim() });
  }
  return pairs.slice(0, 6);
}

function renderArticle(a, lang = 'ar') {
  const isAr     = lang === 'ar';
  const title    = isAr ? a.arabic_title    : a.spanish_title;
  const content  = isAr ? a.arabic_content  : a.spanish_content;
  const meta     = isAr ? a.arabic_meta_description : a.spanish_meta_description;
  const faq      = isAr ? a.arabic_faq      : a.spanish_faq;
  const seoTitle = isAr ? (a.arabic_seo_title||title) : (a.spanish_seo_title||title);
  const img      = imgUrl(a);

  document.documentElement.lang = isAr ? 'ar' : 'es';
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';

  document.getElementById('pageTitle').textContent   = `${seoTitle} | إسبانيا اليوم`;
  document.getElementById('metaDesc').content        = meta || '';
  document.getElementById('ogTitle').content         = title || '';
  document.getElementById('ogDesc').content          = meta || '';
  document.getElementById('ogImage').content         = img;
  document.getElementById('breadCat').textContent    = catLabel(a.category);

  document.getElementById('articleHeader').innerHTML = `
    <span class="article-cat-badge">${catIcon(a.category)} ${catLabel(a.category)}</span>
    <h1 class="article-main-title" style="margin-top:.5rem">${title || ''}</h1>
    <div class="article-meta-bar">
      <span>🕒 ${timeAgo(a.created_at)}</span>
      <span>👁 ${(a.views||0).toLocaleString(isAr?'ar':'es')} مشاهدة</span>
      ${a.source ? `<span>📰 ${a.source}</span>` : ''}
    </div>
    <img class="article-hero-img" src="${img}" alt="${title||''}"
         onerror="this.src='${DEFAULT_IMG}'">`;

  document.getElementById('articleContent').innerHTML =
    parseContent(content) || `<div style="text-align:center;padding:3rem;color:var(--text-muted)"><div style="font-size:3rem">📝</div><p style="margin-top:1rem">المحتوى يُعد حالياً...</p></div>`;

  const faqItems    = parseFAQ(faq || '');
  const faqSection  = document.getElementById('faqSection');
  if (faqItems.length > 0) {
    faqSection.style.display = 'block';
    document.getElementById('faqList').innerHTML = faqItems.map(f => `
      <div class="faq-item">
        <div class="faq-q">${f.q}</div>
        <div class="faq-a">${f.a}</div>
      </div>`).join('');
  }

  const hasSpanish = !!(a.spanish_title && a.spanish_content);
  if (hasSpanish) {
    document.getElementById('langToggle').style.display = 'flex';
    document.getElementById('btnAr').classList.toggle('active', lang === 'ar');
    document.getElementById('btnEs').classList.toggle('active', lang === 'es');
  }
}

function switchLang(lang) {
  if (!currentArticle) return;
  currentLang = lang;
  renderArticle(currentArticle, lang);
}

async function loadRelated(category, excludeSlug) {
  const list = document.getElementById('relatedArticles');
  if (!list) return;
  try {
    const res    = await fetch(`/api/articles?category=${category}&limit=5`);
    const data   = await res.json();
    const filtered = (data.articles||[]).filter(a => a.arabic_slug !== excludeSlug && a.arabic_title).slice(0,4);
    if (filtered.length === 0) { list.innerHTML = '<p style="font-size:.82rem;color:var(--text-muted)">لا توجد مقالات مشابهة</p>'; return; }
    list.innerHTML = filtered.map(a => `
      <div class="popular-item">
        <span class="popular-num">${CATS[a.category]?.icon||'📰'}</span>
        <a href="/article/${a.arabic_slug}" class="popular-title">${a.arabic_title}</a>
      </div>`).join('');
  } catch(e) {}
}

function shareFacebook() {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(location.href)}`,'_blank','width=600,height=400');
}
function shareWhatsApp() {
  const t = currentArticle ? (currentLang==='ar'?currentArticle.arabic_title:currentArticle.spanish_title) : document.title;
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(t+'\n'+location.href)}`,'_blank');
}
function copyLink() {
  navigator.clipboard.writeText(location.href).then(() => {
    const btn = document.querySelector('.share-btn.copy');
    if (btn) { btn.textContent='✅ تم النسخ'; setTimeout(()=>btn.textContent='نسخ الرابط',2000); }
  });
}

document.getElementById('burger')?.addEventListener('click', () => {
  document.getElementById('mainNav')?.classList.toggle('open');
});

(async () => {
  const slug = location.pathname.split('/article/')[1];
  if (!slug) { location='/'; return; }
  try {
    const res = await fetch(`/api/article/${slug}`);
    if (!res.ok) throw new Error('Not found');
    currentArticle = await res.json();
    renderArticle(currentArticle, 'ar');
    loadRelated(currentArticle.category, slug);
  } catch(e) {
    document.getElementById('articleHeader').innerHTML = `
      <div style="text-align:center;padding:4rem;color:var(--text-muted)">
        <div style="font-size:4rem">🔍</div>
        <h2 style="margin-top:1rem">المقال غير موجود</h2>
        <a href="/" style="display:inline-block;margin-top:1.5rem;background:var(--red);color:white;padding:.7rem 2rem;border-radius:999px;font-weight:700">العودة للرئيسية</a>
      </div>`;
    document.getElementById('articleContent').innerHTML = '';
  }
})();
