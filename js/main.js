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

  // LINEで相談：ボタンを押すと、相談内容 → お住まいの地域 → ご連絡方法（電話なら希望日時・電話番号）→ お名前 の順に
  // 選んで・入力してもらい、その内容をまとめた文章を入力した状態でLINEを開く（LINEの「oaMessage」リンク）。
  // 入力内容はサイトには保存せず、LINEのメッセージとしてだけ送られる。
  // JavaScriptが動かない場合は、これまでどおり友だち追加ページが開く。
  var LINE_ID = '@766tgbdp';
  var LINE_ADD_URL = 'https://lin.ee/tZ8Mp71';
  var LINE_SIGN = '\n\n（ホームページから送信）';
  var LINE_TOPICS = [
    { label: '乾太くんの<wbr>無料レンタルを<wbr>試したい', title: '無料レンタルを試したい', text: '乾太くんの無料レンタルを試してみたいです。詳しく教えてください。' },
    { label: '乾太くんの<wbr>購入を<wbr>検討している', title: '購入を検討しています', text: '乾太くんの購入を検討しています。お見積りをお願いします。' },
    { label: '乾太くんについて<wbr>もっと知りたい', title: '乾太くんについて知りたい', text: '乾太くんについて、もっと詳しく知りたいです。' },
    { label: 'その他の<wbr>ご相談', title: 'その他のご相談', text: '（ご相談内容をご記入ください）' }
  ];
  var LINE_AREAS = ['真庭市', '津山市', 'その他'];
  var OPEN_FROM = 8 * 60 + 30;   // 営業時間 8:30〜18:30（電話の希望時間の選択肢）
  var OPEN_TO = 18 * 60 + 30;
  var CLOSED_DAY = 0;            // 定休日：日曜日（0=日）
  var WEEK = ['日', '月', '火', '水', '木', '金', '土'];

  var lineLinks = document.querySelectorAll('a[href^="' + LINE_ADD_URL + '"]');
  if (lineLinks.length && typeof HTMLDialogElement === 'function') {
    var dlg = document.createElement('dialog');
    dlg.className = 'line-dialog';
    dlg.setAttribute('aria-labelledby', 'line-dialog-title');
    document.body.appendChild(dlg);

    var state = {};
    var stepIndex = 0;

    var esc = function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    var hm = function (min) { return Math.floor(min / 60) + ':' + ('0' + (min % 60)).slice(-2); };
    var pad = function (n) { return ('0' + n).slice(-2); };
    var todayStr = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
    var dateLabel = function (v) {
      var p = v.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
      return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WEEK[d.getDay()] + '）';
    };
    var steps = function () {
      var s = ['topic', 'area', 'method'];
      if (state.method === '電話') { s.push('call'); }
      s.push('name', 'confirm');
      return s;
    };
    var message = function () {
      var t = LINE_TOPICS[state.topic];
      var area = state.area === 'その他' ? 'その他' + (state.areaOther ? '（' + state.areaOther + '）' : '') : state.area;
      var lines = ['【' + t.title + '】', t.text, '',
        '■お名前：' + state.name,
        '■お住まいの地域：' + area,
        '■ご希望の連絡方法：' + state.method];
      if (state.method === '電話') {
        lines.push('■お電話の希望日時：' + dateLabel(state.date) + ' ' + hm(state.from) + '〜' + hm(state.to));
        lines.push('■電話番号：' + state.tel);
      }
      return lines.join('\n') + LINE_SIGN;
    };
    var openLine = function () {
      var url = 'https://line.me/R/oaMessage/' + LINE_ID + '/?' + encodeURIComponent(message());
      var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (touch) { window.location.href = url; } else { window.open(url, '_blank', 'noopener'); }
    };
    var choiceList = function (items, current) {
      var h = '<ul class="line-dialog__list">';
      for (var i = 0; i < items.length; i++) {
        h += '<li><button type="button" class="line-dialog__choice' + (current === i ? ' is-selected' : '') + '" data-value="' + i + '">' +
             '<span class="line-dialog__num">' + (i + 1) + '</span><span class="line-dialog__label">' + items[i] + '</span>' +
             '<span class="line-dialog__arrow" aria-hidden="true">›</span></button></li>';
      }
      return h + '</ul>';
    };
    var timeOptions = function (from, to, selected) {
      var h = '<option value="">選択</option>';
      for (var m = from; m <= to; m += 30) {
        h += '<option value="' + m + '"' + (selected === m ? ' selected' : '') + '>' + hm(m) + '</option>';
      }
      return h;
    };

    var screens = {
      topic: function () {
        return '<h2 class="line-dialog__title" id="line-dialog-title">ご相談内容を<wbr>選んでください</h2>' +
          '<p class="line-dialog__lead">いくつかの質問に答えると、<wbr>LINEに送るメッセージが<wbr>できあがります。</p>' +
          choiceList(LINE_TOPICS.map(function (t) { return t.label; }), state.topic);
      },
      area: function () {
        var other = state.area === 'その他';
        return '<h2 class="line-dialog__title" id="line-dialog-title">お住まいの地域を<wbr>選んでください</h2>' +
          choiceList(LINE_AREAS, LINE_AREAS.indexOf(state.area)) +
          '<div class="line-form" ' + (other ? '' : 'hidden') + ' data-other>' +
          '<label class="line-form__label" for="lf-area">市町村名<span class="line-form__opt">（任意）</span></label>' +
          '<input class="line-form__input" id="lf-area" type="text" autocomplete="address-level2" placeholder="例：美作市" value="' + esc(state.areaOther || '') + '">' +
          '<button type="button" class="btn btn--line line-dialog__next" data-next>次へ</button></div>';
      },
      method: function () {
        return '<h2 class="line-dialog__title" id="line-dialog-title">ご連絡方法を<wbr>選んでください</h2>' +
          choiceList(['LINEで<wbr>連絡してほしい', '電話で<wbr>連絡してほしい'], state.method === 'LINE' ? 0 : (state.method === '電話' ? 1 : -1));
      },
      call: function () {
        return '<h2 class="line-dialog__title" id="line-dialog-title">お電話の<wbr>ご希望を<wbr>教えてください</h2>' +
          '<p class="line-dialog__lead">営業時間は8:30〜18:30、<wbr>日曜日は<wbr>定休日です。</p>' +
          '<div class="line-form">' +
          '<label class="line-form__label" for="lf-date">ご希望の日</label>' +
          '<input class="line-form__input" id="lf-date" type="date" min="' + todayStr() + '" value="' + esc(state.date || '') + '">' +
          '<span class="line-form__label" id="lf-time-label">ご希望の時間帯<span class="line-form__opt">（1時間以上）</span></span>' +
          '<div class="line-form__time" role="group" aria-labelledby="lf-time-label">' +
          '<select class="line-form__input" id="lf-from" aria-label="何時から">' + timeOptions(OPEN_FROM, OPEN_TO - 60, state.from) + '</select>' +
          '<span aria-hidden="true">〜</span>' +
          '<select class="line-form__input" id="lf-to" aria-label="何時まで">' + timeOptions(OPEN_FROM + 60, OPEN_TO, state.to) + '</select></div>' +
          '<label class="line-form__label" for="lf-tel">電話番号</label>' +
          '<input class="line-form__input" id="lf-tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="例：090-1234-5678" value="' + esc(state.tel || '') + '">' +
          '<p class="line-form__error" role="alert" data-error></p>' +
          '<button type="button" class="btn btn--line line-dialog__next" data-next>次へ</button></div>';
      },
      name: function () {
        return '<h2 class="line-dialog__title" id="line-dialog-title">お名前を<wbr>教えてください</h2>' +
          '<div class="line-form">' +
          '<label class="line-form__label" for="lf-name">お名前</label>' +
          '<input class="line-form__input" id="lf-name" type="text" autocomplete="name" placeholder="例：真庭 太郎" value="' + esc(state.name || '') + '">' +
          '<p class="line-form__error" role="alert" data-error></p>' +
          '<button type="button" class="btn btn--line line-dialog__next" data-next>内容を確認する</button></div>';
      },
      confirm: function () {
        return '<h2 class="line-dialog__title" id="line-dialog-title">この内容で<wbr>LINEを開きます</h2>' +
          '<p class="line-dialog__lead">LINEが開いたら、<wbr>送信ボタンを<wbr>押してください。</p>' +
          '<div class="line-dialog__preview">' + esc(message()).replace(/\n/g, '<br>') + '</div>' +
          '<button type="button" class="btn btn--line line-dialog__send" data-send>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3C6.48 3 2 6.58 2 11c0 2.47 1.4 4.68 3.6 6.15L5 21l4.06-2.25c.94.17 1.92.25 2.94.25 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/></svg>' +
          'LINEを開いて<wbr>送る</button>';
      }
    };

    var render = function () {
      var list = steps();
      var key = list[stepIndex];
      var progress = key === 'confirm' ? '確認' : (stepIndex + 1) + ' / ' + (list.length - 1);
      dlg.innerHTML = '<div class="line-dialog__body">' +
        '<button type="button" class="line-dialog__close" aria-label="閉じる">×</button>' +
        '<p class="line-dialog__eyebrow">LINEで相談<span class="line-dialog__step">' + progress + '</span></p>' +
        screens[key]() +
        (stepIndex > 0 ? '<button type="button" class="line-dialog__back" data-back>‹ 戻る</button>' : '') +
        (key === 'topic' ? '<p class="line-dialog__note"><a href="' + LINE_ADD_URL + '" target="_blank" rel="noopener">友だち追加だけする</a></p>' : '') +
        '<p class="line-dialog__privacy">入力内容はこのサイトには保存されず、<wbr>LINEのメッセージとしてだけ<wbr>送られます。</p>' +
        '</div>';
      focusFirst();
    };
    var focusFirst = function () {
      var first = dlg.querySelector('.line-form:not([hidden]) .line-form__input, .line-dialog__choice.is-selected, .line-dialog__choice, [data-send]');
      if (first) { first.focus(); }
    };
    var go = function (delta) { stepIndex = Math.max(0, Math.min(steps().length - 1, stepIndex + delta)); render(); };
    var showError = function (msg) { var e = dlg.querySelector('[data-error]'); if (e) { e.textContent = msg; } };

    var validateCall = function () {
      var date = dlg.querySelector('#lf-date').value;
      var from = dlg.querySelector('#lf-from').value;
      var to = dlg.querySelector('#lf-to').value;
      var tel = dlg.querySelector('#lf-tel').value.trim();
      state.date = date; state.from = from === '' ? null : +from; state.to = to === '' ? null : +to; state.tel = tel;
      if (!date) { return 'ご希望の日を選んでください。'; }
      if (date < todayStr()) { return '今日以降の日を選んでください。'; }
      var p = date.split('-');
      if (new Date(+p[0], +p[1] - 1, +p[2]).getDay() === CLOSED_DAY) { return '日曜日は定休日です。別の日を選んでください。'; }
      if (state.from === null || state.to === null) { return 'ご希望の時間帯を選んでください。'; }
      if (state.to - state.from < 60) { return '時間帯は1時間以上の幅で選んでください。'; }
      var digits = tel.replace(/[^0-9]/g, '');
      if (!/^0\d{9,10}$/.test(digits)) { return '電話番号を正しく入力してください。'; }
      return '';
    };

    dlg.addEventListener('click', function (e) {
      var t = e.target;
      if (t === dlg || t.closest('.line-dialog__close')) { dlg.close(); return; }
      if (t.closest('[data-back]')) { go(-1); return; }
      if (t.closest('[data-send]')) { openLine(); dlg.close(); return; }
      var key = steps()[stepIndex];
      var choice = t.closest('.line-dialog__choice');
      if (choice) {
        var v = +choice.getAttribute('data-value');
        if (key === 'topic') { state.topic = v; go(1); }
        else if (key === 'area') {
          state.area = LINE_AREAS[v];
          if (state.area === 'その他') { render(); } else { state.areaOther = ''; go(1); }
        } else if (key === 'method') { state.method = v === 0 ? 'LINE' : '電話'; go(1); }
        return;
      }
      if (t.closest('[data-next]')) {
        if (key === 'area') { state.areaOther = dlg.querySelector('#lf-area').value.trim(); go(1); }
        else if (key === 'call') { var err = validateCall(); if (err) { showError(err); } else { go(1); } }
        else if (key === 'name') {
          state.name = dlg.querySelector('#lf-name').value.trim();
          if (!state.name) { showError('お名前を入力してください。'); } else { go(1); }
        }
      }
    });
    // 開始時刻を選んだら、終了時刻は1時間以上あとだけ選べるようにする
    dlg.addEventListener('change', function (e) {
      if (e.target.id === 'lf-from') {
        var from = e.target.value === '' ? OPEN_FROM : +e.target.value;
        var to = dlg.querySelector('#lf-to');
        var keep = to.value === '' ? null : +to.value;
        if (keep !== null && keep - from < 60) { keep = null; }
        to.innerHTML = timeOptions(from + 60, OPEN_TO, keep);
      }
    });
    // 入力し直したら、エラーの文を消す
    dlg.addEventListener('input', function () { showError(''); });
    // 入力欄で Enter を押したら「次へ」
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches && e.target.matches('input')) {
        e.preventDefault();
        var next = dlg.querySelector('[data-next]');
        if (next) { next.click(); }
      }
    });

    for (var l = 0; l < lineLinks.length; l++) {
      lineLinks[l].addEventListener('click', function (e) {
        e.preventDefault();
        state = {};
        stepIndex = 0;
        // 「お試し無料レンタル中」のポップから開いたときは、相談内容を「無料レンタル」にして地域の質問から始める
        var topic = this.getAttribute('data-line-topic');
        if (topic !== null) { state.topic = +topic; stepIndex = 1; }
        render();
        dlg.showModal();
        focusFirst();
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
