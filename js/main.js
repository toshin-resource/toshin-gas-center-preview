/* 乾太くん 販売・設置店サイト  共通スクリプト（最小限） */
(function () {
  'use strict';

  // 現在のページのナビにマーク（ヘッダーを全ページ同一HTMLにするため）
  var file = location.pathname.split('/').pop() || 'index.html';
  if (file.indexOf('.html') === -1) { file = 'index.html'; }
  var links = document.querySelectorAll('.global-nav a, .footer-nav a');
  for (var i = 0; i < links.length; i++) {
    var href = links[i].getAttribute('href');
    if (href === file) { links[i].setAttribute('aria-current', 'page'); }
  }

  // 動き：スクロールで要素をふわっと表示（「動きを減らす」設定の端末では何もしない）
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && 'IntersectionObserver' in window) {
    var revealTargets = document.querySelectorAll(
      '.section-head, .theme-head, .split__media, .split__body, .card, .product, .fact, .gallery figure, ' +
      '.steps > li, .faq-group, .contact-box, .callout, .table-wrap, .info-table, .point-list li, .bars'
    );
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var target = entry.target;
          target.classList.add('is-visible');
          observer.unobserve(target);
          // 表示し終わったら時間差を外す（ホバー時の反応が遅れないように）
          setTimeout(function () { target.style.transitionDelay = ''; }, 1200);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    for (var r = 0; r < revealTargets.length; r++) {
      var el = revealTargets[r];
      if (el.closest('.global-nav')) { continue; }
      // 横並びのカードは少しずつ時間差で表示
      var siblings = el.parentElement ? el.parentElement.children : [];
      var index = Array.prototype.indexOf.call(siblings, el);
      if (index > 0) { el.style.transitionDelay = Math.min(index, 3) * 90 + 'ms'; }
      el.classList.add('reveal');
      observer.observe(el);
    }
  }

  // 動き：スクロールしたらヘッダーに薄い影
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-scrolled', window.scrollY > 8); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ハンバーガーメニュー
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('global-nav');
  if (!toggle || !nav) { return; }

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('nav-open', open);
  }

  toggle.addEventListener('click', function () {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('a')) { setOpen(false); }
  });

  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 900 && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); }
  });
})();
