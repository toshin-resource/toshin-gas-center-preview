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

  // LINEで相談：ボタンを押すと相談内容を選んでもらい、内容に合った文章を入力した状態でLINEを開く
  // （LINEの「oaMessage」リンク。JavaScriptが動かない場合は、これまでどおり友だち追加ページが開く）
  var LINE_ID = '@766tgbdp';
  var LINE_ADD_URL = 'https://lin.ee/tZ8Mp71';
  var LINE_SIGN = '\n\n（ホームページから送信）';
  var LINE_TOPICS = [
    {
      label: '乾太くんの<wbr>無料レンタルを<wbr>試したい',
      text: '【無料レンタルを試したい】\n乾太くんの無料レンタルを試してみたいです。詳しく教えてください。\n' +
            '・お名前：\n・お住まいの地域（市町村）：\n・設置したい場所（洗面所など）：\n・ガスの種類（プロパンガス／都市ガス／わからない）：'
    },
    {
      label: '乾太くんの<wbr>購入を<wbr>検討している',
      text: '【購入を検討しています】\n乾太くんの購入を検討しています。お見積りをお願いします。\n' +
            '・お名前：\n・お住まいの地域（市町村）：\n・設置したい場所（洗面所など）：\n・ガスの種類（プロパンガス／都市ガス／わからない）：\n・ご家族の人数：'
    },
    {
      label: '乾太くんについて<wbr>もっと知りたい',
      text: '【乾太くんについて知りたい】\n乾太くんについて、もっと詳しく知りたいです。\n・知りたいこと：'
    },
    {
      label: 'その他の<wbr>ご相談',
      text: '【その他のご相談】\n（ご相談内容をご記入ください）'
    }
  ];
  var lineLinks = document.querySelectorAll('a[href^="' + LINE_ADD_URL + '"]');
  var canDialog = typeof HTMLDialogElement === 'function';
  if (lineLinks.length && canDialog) {
    var dlg = document.createElement('dialog');
    dlg.className = 'line-dialog';
    dlg.setAttribute('aria-labelledby', 'line-dialog-title');
    var items = '';
    for (var t = 0; t < LINE_TOPICS.length; t++) {
      items += '<li><button type="button" class="line-dialog__choice" data-topic="' + t + '">' +
               '<span class="line-dialog__num">' + (t + 1) + '</span>' +
               '<span class="line-dialog__label">' + LINE_TOPICS[t].label + '</span>' +
               '<span class="line-dialog__arrow" aria-hidden="true">›</span></button></li>';
    }
    dlg.innerHTML = '<div class="line-dialog__body">' +
      '<button type="button" class="line-dialog__close" aria-label="閉じる">×</button>' +
      '<p class="line-dialog__eyebrow">LINEで相談</p>' +
      '<h2 class="line-dialog__title" id="line-dialog-title">ご相談内容を<wbr>選んでください</h2>' +
      '<p class="line-dialog__lead">選ぶとLINEが開き、<wbr>メッセージが<wbr>入力された状態に<wbr>なります。<wbr>内容を確認して<wbr>送信してください。</p>' +
      '<ul class="line-dialog__list">' + items + '</ul>' +
      '<p class="line-dialog__note"><a href="' + LINE_ADD_URL + '" target="_blank" rel="noopener">友だち追加だけする</a></p></div>';
    document.body.appendChild(dlg);

    var openLine = function (text) {
      var url = 'https://line.me/R/oaMessage/' + LINE_ID + '/?' + encodeURIComponent(text + LINE_SIGN);
      var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (touch) { window.location.href = url; } else { window.open(url, '_blank', 'noopener'); }
    };
    dlg.addEventListener('click', function (e) {
      var choice = e.target.closest && e.target.closest('.line-dialog__choice');
      if (choice) {
        openLine(LINE_TOPICS[Number(choice.getAttribute('data-topic'))].text);
        dlg.close();
        return;
      }
      // 閉じるボタン、または枠の外（背景）を押したら閉じる
      if (e.target.closest('.line-dialog__close') || e.target === dlg) { dlg.close(); }
    });
    for (var l = 0; l < lineLinks.length; l++) {
      lineLinks[l].addEventListener('click', function (e) {
        e.preventDefault();
        dlg.showModal();
      });
    }
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
