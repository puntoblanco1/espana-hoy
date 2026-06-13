/* ════════════════════════════
   España Hoy — Article JS
════════════════════════════ */

const CATS = {
  immigration:          { ar: 'الهجرة',          icon: '✈️' },
  residency:            { ar: 'الإقامة',          icon: '🏠' },
  jobs:                 { ar: 'الوظائف',          icon: '💼' },
  housing:              { ar: 'السكن',            icon: '🏘️' },
  education:            { ar: 'التعليم',          icon: '🎓' },
  'cost-of-living':     { ar: 'تكلفة المعيشة',    icon: '💰' },
  'government-benefits':{ ar: 'المساعدات',        icon: '🤝' },
  'crime-safety':       { ar: 'الأمن',            icon: '🛡️' },
  'local-news':         { ar: 'أخبار محلية',      icon: '📰' },
  tourism:              { ar: 'السياحة',          icon: '🌅' },
  business:             { ar: 'الأعمال',          icon: '📈' }
};

let currentArticle = null;
let currentLang = 'ar';

function catLabel(id) { return CATS[id]?.ar || id; }
function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `${Math.floor(diff/60)} دقيقة`;
  if (diff < 86400) return `${Math.floor(diff/3600)} ساعة`;
  return `${Math.floor(diff/86400)} يوم`;
}
function imgUrl(a) {
  if (a.image_url) return a.image_url;
  const prompt = encodeURIComponent(a.arabic_title || 'Spain news');
  return `https://image.pollinations.ai/prompt/${prompt}?width=1200&height=630&nologo=true&seed=${a.id||1}`;
}

// ── Parse simple markdown-like content ───────────────
function parseContent(text) {
  if (!text) return '';
  return text
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^([^<].+)$/gm, (m) => m.startsWith('<') ? m : `<p>${m}</p>`);
}

// ── Parse FAQ (expects "س: ... ج: ..." format) ───────
function parseFAQ(text) {
  if (!text) return [];
  const pairs = [];
  const parts = text.split(/(?=س:|Q:)/g).filter(Boolean);
  for (const part of parts) {
    const qMatch = part.match(/[سQ]:\s*(.+?)(?:\n|ج:|A:)/s);
    const aMatch = part.match(/[جA]:\s*(.+)/s);
    if (qMatch && aMatch) {
      pairs.push({ q: qMatch[1].trim(), a: aMatch[1].trim() });
    }
  }
  if (pairs.length === 0 && text.length > 20) {
    const lines = text.split('\n').filter(l => l.trim());
    for (let i = 0; i < lines.length - 1; i += 2) {
      pairs.push({ q: lines[i].replace(/^[سQq\d\.\-\*]+:?\s*/, ''), a: lines[i+1]?.replace(/^[جAa\-\*]+:?\s*/, '') || '' });
    }
  }
  return pairs.slice(0, 8);
}

// ── Render article ────────────────────────────────────
function renderArticle(a, lang = 'ar') {
  const isAr = lang === 'ar';
  const title   = isAr ? a.arabic_title   : a.spanish_title;
  const content = isAr ? a.arabic_content : a.spanish_content;
  const meta    = isAr ? a.arabic_meta_description : a.spanish_meta_description;
  const faq     = isAr ? a.arabic_faq     : a.spanish_faq;
  const seoTitle = isAr ? (a.arabic_seo_title || title) : (a.spanish_seo_title || title);

  document.documentElement.lang = isAr ? 'ar' : 'es';
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';

  // Meta
  document.getElementById('pageTitle').textContent = `${seoTitle} | إسبانيا اليوم`;
  document.getElementById('metaDesc').content = meta || '';
  document.getElementById('ogTitle').content  = title || '';
  document.getElementById('ogDesc').content   = meta || '';
  document.getElementById('ogImage').content  = imgUrl(a);

  // Breadcrumb
  document.getElementById('breadCat').textContent = catLabel(a.category);

  // Header
  document.getElementById('articleHeader').innerHTML = `
    <span class="article-cat-badge">${CATS[a.category]?.icon || '📰'} ${catLabel(a.category)}</span>
    <h1 class="article-main-title" style="margin-top:.5rem">${title || 'عنوان المقال'}</h1>
    <div class="article-meta-bar">
      <span>🕒 ${timeAgo(a.created_at)}</span>
      <span>👁 ${(a.views||0).toLocaleString(isAr?'ar':'es')} مشاهدة</span>
      ${a.source ? `<span>📰 ${a.source}</span>` : ''}
    </div>
    <img class="article-hero-img" src="${imgUrl(a)}" alt="${title}" 
         onerror="this.src='https://image.pollinations.ai/prompt/spain+europe+news?width=1200&height=630&nologo=true'">`;

  // Content
  document.getElementById('articleContent').innerHTML = parseContent(content) || `
    <div style="text-align:center;padding:3rem;color:var(--text-muted)">
      <div style="font-size:3rem">📝</div>
      <p style="margin-top:1rem">المحتوى يُعد حالياً...</p>
    </div>`;

  // FAQ
  const faqItems = parseFAQ(faq || '');
  const faqSection = document.getElementById('faqSection');
  if (faqItems.length > 0) {
    faqSection.style.display = 'block';
    document.getElementById('faqList').innerHTML = faqItems.map(f => `
      <div class="faq-item">
        <div class="faq-q">${f.q}</div>
        <div class="faq-a">${f.a}</div>
      </div>`).join('');
  }

  // Language toggle visibility
  const hasSpanish = !!(a.spanish_title && a.spanish_content);
  if (hasSpanish) {
    document.getElementById('langToggle').style.display = 'flex';
    document.getElementById('btnAr').classList.toggle('active', lang === 'ar');
    document.getElementById('btnEs').classList.toggle('active', lang === 'es');
  }
}

// ── Language switch ───────────────────────────────────
function switchLang(lang) {
  if (!currentArticle) return;
  currentLang = lang;
  renderArticle(currentArticle, lang);
}

// ── Related articles ──────────────────────────────────
async function loadRelated(category, excludeSlug) {
  try {
    const res = await fetch(`/api/articles?category=${category}&limit=4`);
    const data = await res.json();
    const list = document.getElementById('relatedArticles');
    if (!list) return;
    const filtered = (data.articles || []).filter(a => a.arabic_slug !== excludeSlug).slice(0, 3);
    if (filtered.length === 0) {
      list.innerHTML = '<p style="font-size:.82rem;color:var(--text-muted)">لا توجد مقالات مشابهة</p>';
      return;
    }
    list.innerHTML = filtered.map(a => `
      <div class="popular-item">
        <span class="popular-num">${CATS[a.category]?.icon || '📰'}</span>
        <a href="/article/${a.arabic_slug}" class="popular-title">${a.arabic_title}</a>
      </div>`).join('');
  } catch(e) {}
}

// ── Share functions ───────────────────────────────────
function shareFacebook() {
  const url = encodeURIComponent(window.location.href);
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
}
function shareWhatsApp() {
  const title = currentArticle ? (currentLang === 'ar' ? currentArticle.arabic_title : currentArticle.spanish_title) : document.title;
  const url = encodeURIComponent(window.location.href);
  window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(title + '\n')}${url}`, '_blank');
}
function copyLink() {
  navigator.clipboard.writeText(window.location.href).then(() => {
    const btn = document.querySelector('.share-btn.copy');
    if (btn) { btn.textContent = '✅ تم النسخ'; setTimeout(() => btn.textContent = 'نسخ الرابط', 2000); }
  });
}

// ── Burger menu ───────────────────────────────────────
document.getElementById('burger')?.addEventListener('click', () => {
  document.getElementById('mainNav')?.classList.toggle('open');
});

// ── Init ──────────────────────────────────────────────
(async () => {
  const slug = window.location.pathname.split('/article/')[1];
  if (!slug) { window.location = '/'; return; }

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
