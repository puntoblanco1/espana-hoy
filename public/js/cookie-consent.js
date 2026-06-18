/**
 * España Hoy — Cookie Consent Banner (self-hosted, no external dependency)
 *
 * What this does:
 *  - Shows a GDPR-style notice to first-time visitors and stores their choice.
 *  - Exposes window.ehConsent = { status: 'accepted'|'rejected'|'unknown', granted(category) }
 *  - Fires a 'eh-consent-change' event on document so other scripts (analytics, ad tags)
 *    can wait for consent before running anything non-essential.
 *
 * IMPORTANT — read this before relying on it for Google AdSense:
 *  This banner is good general GDPR/ePrivacy practice (cookie disclosure + consent log),
 *  but it is NOT a Google-certified TCF CMP. For Google's EU User Consent Policy
 *  (required to serve ads to EEA/UK/Switzerland users), once the AdSense account is
 *  approved, enable AdSense → Privacy & messaging → "European regulations message".
 *  That feature is Google's own certified CMP and is the one that actually satisfies
 *  the TCF requirement. Keep this banner too — it covers the wider GDPR cookie-consent
 *  duty for the site (e.g. for the view-counter and analytics cookies), which is separate
 *  from the ad-specific TCF requirement.
 */
(function () {
  var STORAGE_KEY = 'eh_cookie_consent';
  var STORAGE_VERSION = 'v1';

  function readStored() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed.version !== STORAGE_VERSION) return null;
      return parsed;
    } catch (e) { return null; }
  }

  function store(status) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: STORAGE_VERSION,
        status: status,
        ts: new Date().toISOString()
      }));
    } catch (e) { /* localStorage unavailable, ignore */ }
  }

  window.ehConsent = {
    status: 'unknown',
    granted: function (category) {
      // category: 'ads' | 'analytics' | 'necessary'
      if (category === 'necessary') return true;
      return window.ehConsent.status === 'accepted';
    }
  };

  function setStatus(status) {
    window.ehConsent.status = status;
    store(status);
    document.dispatchEvent(new CustomEvent('eh-consent-change', { detail: { status: status } }));
    hideBanner();
  }

  var bannerEl;

  function buildBanner() {
    bannerEl = document.createElement('div');
    bannerEl.className = 'cc-banner';
    bannerEl.setAttribute('role', 'dialog');
    bannerEl.setAttribute('aria-label', 'إشعار الكوكيز');
    bannerEl.innerHTML =
      '<div class="cc-banner-inner">' +
        '<div class="cc-banner-text">' +
          'نستخدم كوكيز ضرورية لتشغيل الموقع، وكوكيز اختيارية للتحليلات والإعلانات (Google AdSense) بعد موافقتك. ' +
          'لمزيد من التفاصيل راجع <a href="/privacy">سياسة الخصوصية</a>.' +
        '</div>' +
        '<div class="cc-banner-actions">' +
          '<button type="button" class="cc-btn cc-btn-reject" data-cc="reject">ضروري فقط</button>' +
          '<button type="button" class="cc-btn cc-btn-accept" data-cc="accept">قبول الكل</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(bannerEl);
    bannerEl.querySelector('[data-cc="accept"]').addEventListener('click', function () { setStatus('accepted'); });
    bannerEl.querySelector('[data-cc="reject"]').addEventListener('click', function () { setStatus('rejected'); });
  }

  function showBanner() {
    if (!bannerEl) buildBanner();
    requestAnimationFrame(function () { bannerEl.classList.add('cc-show'); });
  }

  function hideBanner() {
    if (bannerEl) bannerEl.classList.remove('cc-show');
  }

  document.addEventListener('DOMContentLoaded', function () {
    var existing = readStored();
    if (existing) {
      window.ehConsent.status = existing.status;
      document.dispatchEvent(new CustomEvent('eh-consent-change', { detail: { status: existing.status } }));
    } else {
      showBanner();
    }
  });
})();
