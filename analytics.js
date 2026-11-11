/* Google Analytics and Google Ads for Feel Home Stays.
   Nothing is loaded from Google until the visitor accepts in the banner.
   With both IDs empty this file does nothing and no banner appears. */
(function () {
  var GA_ID = 'G-RPJZZ13TV5';   // Google Analytics measurement ID, e.g. 'G-XXXXXXXXXX'
  var ADS_ID = '';  // optional Google Ads tag ID, e.g. 'AW-1234567890'

  var KEY = 'fhs_consent';
  var loaded = false;
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  // Pages call this for booking events. Ignored unless the visitor accepted.
  window.fhsTrack = function (name, params) { if (loaded) gtag('event', name, params || {}); };

  if (!GA_ID && !ADS_ID) return;

  function load() {
    if (loaded) return;
    loaded = true;
    gtag('consent', 'default', { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' });
    gtag('js', new Date());
    if (GA_ID) gtag('config', GA_ID);
    if (ADS_ID) gtag('config', ADS_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID || ADS_ID);
    document.head.appendChild(s);
  }

  function banner() {
    if (document.getElementById('fhs-consent')) return;
    var box = document.createElement('div');
    box.id = 'fhs-consent';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Cookie choice');
    box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:50;max-width:560px;margin:0 auto;' +
      'background:var(--surface,#fff);color:var(--ink,#1c2129);border:1px solid var(--line,#d7d4c7);' +
      'border-radius:14px;padding:16px 18px;box-shadow:0 8px 30px rgba(0,0,0,.18);font-size:.88rem;line-height:1.45;';
    var p = document.createElement('p');
    p.style.margin = '0 0 12px';
    p.textContent = 'We would like to use Google Analytics and Google Ads cookies to see how the site is used and whether our adverts work. They are only set if you accept.';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';
    function button(label, primary, value) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.style.cssText = 'flex:1 1 140px;font:inherit;font-weight:600;padding:10px 14px;border-radius:9px;cursor:pointer;' +
        (primary ? 'background:var(--accent,#2f5d5a);color:var(--accent-ink,#f4f7f6);border:0;'
                 : 'background:transparent;color:var(--ink,#1c2129);border:1px solid var(--line,#d7d4c7);');
      b.addEventListener('click', function () {
        save(value);
        box.remove();
        if (value === 'yes') load();
        else if (loaded) location.reload();
      });
      return b;
    }
    row.appendChild(button('Decline', false, 'no'));
    row.appendChild(button('Accept', true, 'yes'));
    box.appendChild(p);
    box.appendChild(row);
    document.body.appendChild(box);
  }

  function start() {
    var choice = read();
    if (choice === 'yes') load();
    else if (choice !== 'no') banner();
    // "Cookie settings" link in the footer reopens the choice.
    var foot = document.querySelector('footer');
    if (foot) {
      var a = document.createElement('a');
      a.href = '#';
      a.textContent = 'Cookie settings';
      a.style.cssText = 'font-size:.78rem;color:var(--ink-soft,#5b6069);margin-top:10px;display:inline-block;';
      a.addEventListener('click', function (e) { e.preventDefault(); banner(); });
      foot.appendChild(a);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
