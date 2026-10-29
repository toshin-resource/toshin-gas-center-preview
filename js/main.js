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
    { label: '乾太くんの<wbr>購入を<wbr>検討している', title: '購入を検討しています', text: '乾太くんの購入を検討しています。詳しく教えてください。' },
    { label: '乾太くんの<wbr>見積もりを<wbr>依頼したい', title: 'お見積りのご依頼', text: '乾太くんのお見積りをお願いします。' },
    { label: '乾太くんについて<wbr>もっと知りたい', title: '乾太くんについて知りたい', text: '乾太くんについて、もっと詳しく知りたいです。' },
    { label: 'その他の<wbr>ご相談', title: 'その他のご相談', text: '' }
  ];
  // 設置可能エリア（最後の「その他」は、エリア外の方用。市町村名を書いてもらう）
  var LINE_AREAS = ['真庭市', '津山市', '美作市', '苫田郡', '勝田郡', '久米郡', 'その他'];
  // 「乾太くんについてもっと知りたい」を選んだときに出す、よくある質問の一覧と答え。
  // 各ページの <script type="application/json" id="faq-data"> から読む（tools/sync_faq.py が faq.html から作る）
  var FAQ = [];
  try { var faqEl = document.getElementById('faq-data'); if (faqEl) { FAQ = JSON.parse(faqEl.textContent); } } catch (e) { FAQ = []; }
  // 「見積もりを依頼したい」を選んだときに聞くこと（それぞれ1つ選ぶ）
  var LINE_ESTIMATE = [
    { key: 'model', label: 'ご希望の機種', options: ['デラックス 9kg', 'デラックス 6kg', 'スタンダード 8kg', 'スタンダード 5kg', 'スタンダード 3kg', 'まだ決めていない'] },
    { key: 'gas', label: 'お使いのガス・電気', options: ['プロパンガス', 'オール電化', 'わからない'], note: '※都市ガスのお宅には設置できません' },
    { key: 'place', label: '設置場所', options: ['屋内（洗面所など）', '屋外（軒下など）', 'まだ決めていない'], note: '※屋外は、雨が直接かからない場所に限ります' }
  ];
  var TOPIC_ESTIMATE = 2;        // LINE_TOPICS の「見積もりを依頼したい」の番号（0から数える）
  var TOPIC_KNOW = 3;            // LINE_TOPICS の「もっと知りたい」の番号
  var TOPIC_OTHER = 4;           // LINE_TOPICS の「その他のご相談」の番号
  var OPEN_FROM = 9 * 60;        // お電話の希望時間として選べる範囲：9:00〜17:00
  var OPEN_TO = 17 * 60;
  var CLOSED_DAY = 0;            // 定休日：日曜日（0=日）。日付の一覧に出さない（祝日も出さない）
  // 祝日のほかに休む日（年末年始・お盆など）。'2026-12-31' のように書くと、日付の一覧に出なくなる
  var EXTRA_CLOSED = [];
  var DATE_DAYS = 30;            // 日付の一覧に出す日数
  var WEEK = ['日', '月', '火', '水', '木', '金', '土'];

  var openLineEstimate = null; // 下の「LINEで相談」の画面を、見積もりの機種を選んだ状態で開く（機種のポップアップから使う）
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
    // 今日を選んだときに選べる最も早い開始時刻（今から30分以上あと、30分刻み）
    var firstFrom = function (dateStr) {
      if (dateStr !== todayStr()) { return OPEN_FROM; }
      var now = new Date();
      var m = Math.ceil((now.getHours() * 60 + now.getMinutes() + 30) / 30) * 30;
      return Math.max(OPEN_FROM, m);
    };
    // 日本の祝日か（国民の祝日・振替休日・国民の休日。春分・秋分は計算式で求める）
    var isBaseHoliday = function (d) {
      var y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate(), w = d.getDay();
      var nth = Math.floor((day - 1) / 7) + 1;   // その曜日の第何週か
      var shunbun = Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
      var shubun = Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4));
      return (m === 1 && (day === 1 || (w === 1 && nth === 2))) ||           // 元日・成人の日
        (m === 2 && (day === 11 || day === 23)) ||                             // 建国記念の日・天皇誕生日
        (m === 3 && day === shunbun) ||                                        // 春分の日
        (m === 4 && day === 29) ||                                             // 昭和の日
        (m === 5 && (day === 3 || day === 4 || day === 5)) ||                  // 憲法記念日・みどりの日・こどもの日
        (m === 7 && w === 1 && nth === 3) ||                                   // 海の日
        (m === 8 && day === 11) ||                                             // 山の日
        (m === 9 && ((w === 1 && nth === 3) || day === shubun)) ||             // 敬老の日・秋分の日
        (m === 10 && w === 1 && nth === 2) ||                                  // スポーツの日
        (m === 11 && (day === 3 || day === 23));                               // 文化の日・勤労感謝の日
    };
    var addDays = function (d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); };
    var isHoliday = function (d) {
      if (isBaseHoliday(d)) { return true; }
      // 振替休日：日曜日の祝日のあと、最初の祝日でない日
      for (var k = 1; k < 7; k++) {
        var p = addDays(d, -k);
        if (!isBaseHoliday(p)) { break; }
        if (p.getDay() === 0) { return true; }
      }
      // 国民の休日：祝日にはさまれた日
      return d.getDay() !== 0 && isBaseHoliday(addDays(d, -1)) && isBaseHoliday(addDays(d, 1));
    };
    // 日付の一覧：明日から（今日のご希望はお電話で）。日曜日・祝日・EXTRA_CLOSED の日は出さない
    var dateOptions = function (selected) {
      var h = '<option value="">選択してください</option>';
      var d = new Date();
      d.setDate(d.getDate() + 1);
      for (var i = 1; i <= DATE_DAYS; i++, d.setDate(d.getDate() + 1)) {
        var v = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        if (d.getDay() === CLOSED_DAY || isHoliday(d) || EXTRA_CLOSED.indexOf(v) !== -1) { continue; }
        h += '<option value="' + v + '"' + (selected === v ? ' selected' : '') + '>' + dateLabel(v) + (i === 1 ? '・明日' : '') + '</option>';
      }
      return h;
    };
    var dateLabel = function (v) {
      var p = v.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]);
      return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + WEEK[d.getDay()] + '）';
    };
    var steps = function () {
      // 「もっと知りたい」「その他」は内容が相談の中心なので最初に、
      // 無料レンタル・購入検討の「ご質問・ご要望（任意）」は最後（お名前のあと）に聞く
      var detailFirst = state.topic === TOPIC_KNOW || state.topic === TOPIC_OTHER;
      var s = ['topic'];
      if (state.topic === TOPIC_ESTIMATE) { s.push('estimate'); }
      if (state.topic === TOPIC_KNOW && FAQ.length) { s.push('faq'); }
      if (detailFirst) { s.push('detail'); }
      s.push('area', 'method');
      if (state.method === '電話') { s.push('call'); }
      s.push('name');
      if (!detailFirst) { s.push('detail'); }
      s.push('confirm');
      return s;
    };
    // 次が確認画面なら「内容を確認する」、それ以外は「次へ」
    var nextLabel = function () { return steps()[stepIndex + 1] === 'confirm' ? '内容を確認する' : '次へ'; };
    var message = function () {
      var t = LINE_TOPICS[state.topic];
      var area = state.area === 'その他' ? 'その他' + (state.areaOther ? '（' + state.areaOther + '）' : '') : state.area;
      var lines = ['【' + t.title + '】'];
      if (t.text) { lines.push(t.text); }
      if (state.topic === TOPIC_ESTIMATE) {
        for (var k = 0; k < LINE_ESTIMATE.length; k++) {
          var val = state[LINE_ESTIMATE[k].key];
          // ラインナップの機種のポップアップから開いたときは、型式も添える（機種を選び直したときは添えない）
          if (LINE_ESTIMATE[k].key === 'model' && state.modelPick && state.modelPick.option === val) { val += '（' + state.modelPick.name + '）'; }
          lines.push('■' + LINE_ESTIMATE[k].label + '：' + val);
        }
      }
      if (state.topic === TOPIC_KNOW) {
        if (state.faqQ) { lines.push('■知りたいこと：' + state.faqQ); }
        if (state.detail) { lines.push('■ご質問：' + state.detail); }
      } else if (state.topic === TOPIC_OTHER) {
        lines.push('■ご相談内容：' + state.detail);
      } else if (state.detail) {
        lines.push('■ご質問・ご要望：' + state.detail);
      }
      lines.push('',
        '■お名前：' + state.name,
        '■お住まいの地域：' + area,
        '■ご希望の連絡方法：' + state.method);
      if (state.method === '電話') {
        lines.push('■お電話の希望日時：' + dateLabel(state.date) + ' ' + hm(state.from) + '〜' + hm(state.to));
        lines.push('■電話番号：' + state.tel);
      }
      return lines.join('\n') + LINE_SIGN;
    };
    var lineUrl = function () { return 'https://line.me/R/oaMessage/' + LINE_ID + '/?' + encodeURIComponent(message()); };
    // スマホ（指で操作する端末）か、PC（マウスで操作する端末）か
    var isTouch = function () { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches); };
    var openLine = function () {
      if (isTouch()) { window.location.href = lineUrl(); } else { window.open(lineUrl(), '_blank', 'noopener'); }
    };
    // PC では、メッセージ入りの LINE のリンクを QR コードにして表示し、スマホで読み取ってもらう
    // （QR コードは js/vendor/qrcode.js を必要なときだけ読み込んで作る）
    var loadQrLib = function (done) {
      if (window.qrcode) { done(true); return; }
      var sc = document.createElement('script');
      sc.src = 'js/vendor/qrcode.js';
      sc.onload = function () { done(!!window.qrcode); };
      sc.onerror = function () { done(false); };
      document.head.appendChild(sc);
    };
    var drawQr = function () {
      var box = dlg.querySelector('[data-qr]');
      if (!box) { return; }
      loadQrLib(function (ok) {
        if (!ok || !dlg.contains(box)) {
          box.innerHTML = '<p class="line-qr__error">QRコードを表示できませんでした。<wbr>下のボタンから<wbr>LINEを開いてください。</p>';
          return;
        }
        // QR には日本語を %変換せずそのまま（UTF-8）入れて、データ量を約3分の1にする。
        // 読み取ったスマホ側で正しい形に直して LINE が開く。改行・記号などの半角文字だけ %変換する
        var text = message(), q = '';
        for (var i = 0; i < text.length; i++) {
          var ch = text.charAt(i);
          q += ch.charCodeAt(0) > 127 ? ch : encodeURIComponent(ch);
        }
        window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs['UTF-8'];
        var qr = window.qrcode(0, 'L'); // 誤り訂正は最低（L）にして、マスをできるだけ大きくする
        qr.addData('https://line.me/R/oaMessage/' + LINE_ID + '/?' + q, 'Byte');
        qr.make();
        // 1マスを画面のピクセルの整数倍（3px以上）で描くと、くっきりしてスマホで読み取りやすい
        var modules = qr.getModuleCount() + 8;          // 周りの白い余白（4マスずつ）を含めたマス数
        var dpr = window.devicePixelRatio || 1;
        var room = box.clientWidth || 320;
        var cell = Math.max(3, Math.floor(room * dpr / modules)) / dpr;
        box.innerHTML = qr.createSvgTag({ cellSize: 1, margin: 4, scalable: true }); // cellSize 1 なので margin 4 = 4マス
        var svg = box.querySelector('svg');
        if (svg) {
          svg.setAttribute('role', 'img');
          svg.setAttribute('aria-label', 'LINEで相談するためのQRコード');
          svg.style.width = svg.style.height = (cell * modules) + 'px';
        }
      });
    };
    var choiceList = function (items, current, extraClass) {
      var h = '<ul class="line-dialog__list' + (extraClass ? ' ' + extraClass : '') + '">';
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
      detail: function () {
        // 無料レンタル・購入検討：ご質問・ご要望の自由記入（任意。空のまま次へ進める）
        if (state.topic !== TOPIC_KNOW && state.topic !== TOPIC_OTHER) {
          return '<h2 class="line-dialog__title" id="line-dialog-title">ご質問・ご要望が<wbr>あれば<wbr>ご記入ください</h2>' +
            '<p class="line-dialog__lead">なければ、<wbr>そのまま<wbr>「' + nextLabel() + '」で<wbr>大丈夫です。</p>' +
            '<div class="line-form">' +
            '<label class="line-form__label" for="lf-detail">ご質問・ご要望<span class="line-form__opt">（自由記入・任意）</span></label>' +
            '<textarea class="line-form__input line-form__textarea" id="lf-detail" rows="4" placeholder="' +
            (state.topic === 0 ? '例：レンタルの期間を知りたいです' : state.topic === TOPIC_ESTIMATE ? '例：今の乾燥機からの買い替えです' : '例：9kgと6kgで迷っています') + '">' + esc(state.detail || '') + '</textarea>' +
            '<p class="line-form__error" role="alert" data-error></p>' +
            '<button type="button" class="btn btn--line line-dialog__next" data-next>' + nextLabel() + '</button></div>';
        }
        if (state.topic === TOPIC_KNOW) {
          // よくある質問から選んだ質問があれば表示し、くわしく知りたいことは任意。選んでいなければ質問の入力は必須
          var picked = state.faqQ;
          return '<h2 class="line-dialog__title" id="line-dialog-title">' + (picked ? 'くわしく<wbr>知りたいことを<wbr>教えてください' : 'ご質問を<wbr>ご記入ください') + '</h2>' +
            (picked ? '<p class="line-faq__picked"><span>選んだ質問</span>' + esc(picked) + '</p>' +
              '<p class="line-dialog__lead">答えで<wbr>わからなかった<wbr>ことなどが<wbr>あれば<wbr>ご記入ください。<wbr>なければ、<wbr>そのまま<wbr>「次へ」で<wbr>大丈夫です。</p>'
              : '<p class="line-dialog__lead">ご記入いただいた<wbr>ご質問は、<wbr>LINEで<wbr>お送りいただけます。<wbr>担当者から<wbr>お答えします。</p>') +
            '<div class="line-form">' +
            '<label class="line-form__label" for="lf-detail">' + (picked ? 'くわしく知りたいこと<span class="line-form__opt">（自由記入・任意）</span>' : 'ご質問') + '</label>' +
            '<textarea class="line-form__input line-form__textarea" id="lf-detail" rows="4" placeholder="例：洗面所に置けるか知りたいです">' + esc(state.detail || '') + '</textarea>' +
            '<p class="line-form__error" role="alert" data-error></p>' +
            '<button type="button" class="btn btn--line line-dialog__next" data-next>次へ</button></div>';
        }
        var text = '<label class="line-form__label" for="lf-detail">ご相談内容</label>' +
          '<textarea class="line-form__input line-form__textarea" id="lf-detail" rows="4" placeholder="ご自由にご記入ください">' + esc(state.detail || '') + '</textarea>';
        return '<h2 class="line-dialog__title" id="line-dialog-title">ご相談内容を<wbr>ご記入ください</h2>' +
          '<div class="line-form">' + text +
          '<p class="line-form__error" role="alert" data-error></p>' +
          '<button type="button" class="btn btn--line line-dialog__next" data-next>次へ</button></div>';
      },
      faq: function () {
        // よくある質問：質問を押すと答えが開く。答えで足りなければ、その質問について LINE で聞ける
        var h = '';
        for (var g = 0; g < FAQ.length; g++) {
          // グループごとに色を変える（製品＝青・設置＝緑・使い方＝オレンジ・ご依頼＝ピンク。CSS の line-faq--c0〜c3）
          var tone = ' line-faq--c' + (g % 4);
          h += '<h3 class="line-faq__group' + tone + '">' + FAQ[g].title + '</h3><div class="line-faq' + tone + '">';
          for (var i = 0; i < FAQ[g].items.length; i++) {
            var it = FAQ[g].items[i];
            h += '<details class="line-faq__item" name="line-faq"><summary>' + it.q + '</summary>' +
                 '<div class="line-faq__a">' + it.a +
                 '<button type="button" class="line-faq__ask" data-faq-ask="' + g + '-' + i + '">この質問について<wbr>LINEで聞く ›</button></div></details>';
          }
          h += '</div>';
        }
        return '<h2 class="line-dialog__title" id="line-dialog-title">知りたいことを<wbr>選んでください</h2>' +
          '<p class="line-dialog__lead">よくある質問です。<wbr>質問を押すと、<wbr>答えが<wbr>表示されます。</p>' +
          '<p class="line-faq__skip"><button type="button" data-faq-free>一覧にない<wbr>質問を<wbr>入力する ›</button></p>' + h +
          '<div class="line-faq__none"><p>知りたいことが<wbr>見つからない<wbr>ときは</p>' +
          '<button type="button" class="btn btn--line line-dialog__next" data-faq-free>質問を入力して<wbr>LINEで送る</button></div>';
      },
      estimate: function () {
        var groups = '';
        for (var g = 0; g < LINE_ESTIMATE.length; g++) {
          var item = LINE_ESTIMATE[g];
          groups += '<fieldset class="line-radios"><legend class="line-form__label">' + item.label + '</legend><div class="line-radios__list">';
          for (var o = 0; o < item.options.length; o++) {
            groups += '<label class="line-check line-radio"><input type="radio" class="line-check__input" name="lf-' + item.key + '" value="' + o + '"' +
                      (state[item.key] === item.options[o] ? ' checked' : '') + '><span>' + item.options[o].replace('（', '<wbr>（').replace('まだ決めて', 'まだ<wbr>決めて') + '</span></label>';
          }
          groups += '</div>' + (item.note ? '<p class="line-radios__note">' + item.note + '</p>' : '') + '</fieldset>';
        }
        return '<h2 class="line-dialog__title" id="line-dialog-title">お見積りの<wbr>内容を<wbr>選んでください</h2>' +
          '<p class="line-dialog__lead">わかる範囲で<wbr>お選びください。<wbr>現地確認・お見積りは<wbr>無料です。</p>' +
          '<div class="line-form">' + groups +
          '<p class="line-form__error" role="alert" data-error></p>' +
          '<button type="button" class="btn btn--line line-dialog__next" data-next>次へ</button></div>';
      },
      area: function () {
        var other = state.area === 'その他';
        return '<h2 class="line-dialog__title" id="line-dialog-title">お住まいの地域を<wbr>選んでください</h2>' +
          '<div class="line-dialog__terms"><p><strong>設置可能エリア</strong>岡山県 真庭市・<wbr>津山市・<wbr>美作市・<wbr>苫田郡・<wbr>勝田郡・<wbr>久米郡</p>' +
          '<p><strong>設置条件</strong>戸建て・<wbr>オール電化・<wbr>プロパンガスなどを<wbr>お使いの<wbr>お客様<wbr>（都市ガス不可）。<wbr>屋外は<wbr>雨が<wbr>直接<wbr>かからない<wbr>場所</p></div>' +
          choiceList(LINE_AREAS.map(function (a) { return a === 'その他' ? 'その他の<wbr>地域' : a; }), LINE_AREAS.indexOf(state.area), 'line-dialog__list--grid') +
          '<div class="line-form" ' + (other ? '' : 'hidden') + ' data-other>' +
          '<p class="line-radios__note">エリア外の<wbr>場合、<wbr>設置を<wbr>お受け<wbr>できない<wbr>ことが<wbr>あります。</p>' +
          '<label class="line-form__label" for="lf-area">市町村名<span class="line-form__opt">（任意）</span></label>' +
          '<input class="line-form__input" id="lf-area" type="text" autocomplete="address-level2" placeholder="例：岡山市" value="' + esc(state.areaOther || '') + '">' +
          '<button type="button" class="btn btn--line line-dialog__next" data-next>次へ</button></div>';
      },
      method: function () {
        return '<h2 class="line-dialog__title" id="line-dialog-title">ご連絡方法を<wbr>選んでください</h2>' +
          choiceList(['LINEで<wbr>連絡してほしい<span class="line-dialog__sub">※返信は<wbr>平日・土曜日の<wbr><span class="nw">9:00〜17:00</span>です。<wbr>少しお時間を<wbr>いただく<wbr>場合があります</span>', '電話で<wbr>連絡してほしい'],
            state.method === 'LINE' ? 0 : (state.method === '電話' ? 1 : -1));
      },
      call: function () {
        return '<h2 class="line-dialog__title" id="line-dialog-title">お電話の<wbr>ご希望を<wbr>教えてください</h2>' +
          '<p class="line-dialog__lead">明日以降の<wbr>平日・土曜日、<wbr><span class="nw">9:00〜17:00</span>の間で<wbr>お選びください。<wbr>日曜日・祝日は<wbr>お休みです。</p>' +
          '<p class="line-dialog__urgent">本日中の<wbr>ご連絡を<wbr>希望の方・<wbr>お急ぎの方は、<wbr>お電話ください。<br>' +
          '<a href="tel:0867445552">真庭地域の方 <span class="nw">0867-44-5552</span><span class="line-dialog__urgent-area">（美作市・<wbr>苫田郡・<wbr>勝田郡・<wbr>久米郡の方も<wbr>こちら）</span></a><a href="tel:0868201653">津山地域の方 <span class="nw">0868-20-1653</span></a></p>' +
          '<div class="line-form">' +
          '<label class="line-form__label" for="lf-date">ご希望の日</label>' +
          '<select class="line-form__input" id="lf-date">' + dateOptions(state.date) + '</select>' +
          '<span class="line-form__label" id="lf-time-label">ご希望の時間帯<span class="line-form__opt">（1時間以上）</span></span>' +
          '<div class="line-form__time" role="group" aria-labelledby="lf-time-label">' +
          '<select class="line-form__input" id="lf-from" aria-label="何時から">' + timeOptions(firstFrom(state.date || ''), OPEN_TO - 60, state.from) + '</select>' +
          '<span aria-hidden="true">〜</span>' +
          '<select class="line-form__input" id="lf-to" aria-label="何時まで">' + timeOptions((state.from || firstFrom(state.date || '')) + 60, OPEN_TO, state.to) + '</select></div>' +
          '<label class="line-form__label" for="lf-tel">電話番号</label>' +
          '<input class="line-form__input" id="lf-tel" type="tel" inputmode="tel" autocomplete="tel" placeholder="例：090-1234-5678" value="' + esc(state.tel || '') + '">' +
          '<p class="line-form__error" role="alert" data-error></p>' +
          '<button type="button" class="btn btn--line line-dialog__next" data-next>次へ</button></div>';
      },
      name: function () {
        return '<h2 class="line-dialog__title" id="line-dialog-title">お名前を<wbr>教えてください</h2>' +
          '<div class="line-form">' +
          '<label class="line-form__label" for="lf-name">お名前</label>' +
          '<input class="line-form__input" id="lf-name" type="text" autocomplete="name" placeholder="例：瀬島 祐介" value="' + esc(state.name || '') + '">' +
          '<p class="line-form__error" role="alert" data-error></p>' +
          '<button type="button" class="btn btn--line line-dialog__next" data-next>' + nextLabel() + '</button></div>';
      },
      confirm: function () {
        var notice = state.method === 'LINE' ? '<p class="line-dialog__notice">※⁠LINEでの<wbr>ご返信は、<wbr>平日・土曜日の<wbr><span class="nw">9:00〜17:00</span>に<wbr>順次いたします<wbr>（日曜日・祝日は<wbr>お休み）。<wbr>少しお時間を<wbr>いただく場合が<wbr>あります。</p>' : '';
        if (!isTouch()) {
          // PC：左にメッセージ、右に QR コード
          return '<h2 class="line-dialog__title" id="line-dialog-title">スマホで<wbr>QRコードを<wbr>読み取ってください</h2>' +
            '<p class="line-dialog__lead">スマホのカメラ（または<wbr>LINEの<wbr>QRコードリーダー）で<wbr>読み取ると、<wbr>下の内容が<wbr>入力された状態で<wbr>LINEが開きます。<wbr>そのまま<wbr>送信してください。</p>' +
            '<div class="line-confirm">' +
            '<div class="line-confirm__text"><div class="line-dialog__preview">' + esc(message()).replace(/\n/g, '<br>') + '</div>' + notice + '</div>' +
            '<div class="line-qr"><div class="line-qr__code" data-qr><p class="line-qr__loading">QRコードを作成中…</p></div>' +
            '<p class="line-qr__caption">読み取りにくいときは、<wbr>スマホを<wbr>少し近づけたり<wbr>離したりしてください。</p></div>' +
            '</div>' +
            '<button type="button" class="line-dialog__pc-open" data-send>このパソコンの<wbr>LINEで開く ›</button>';
        }
        return '<h2 class="line-dialog__title" id="line-dialog-title">この内容で<wbr>LINEを開きます</h2>' +
          '<p class="line-dialog__lead">LINEが開いたら、<wbr>送信ボタンを<wbr>押してください。</p>' +
          '<div class="line-dialog__preview">' + esc(message()).replace(/\n/g, '<br>') + '</div>' +
          (state.method === 'LINE' ? '<p class="line-dialog__notice">※⁠LINEでの<wbr>ご返信は、<wbr>平日・土曜日の<wbr><span class="nw">9:00〜17:00</span>に<wbr>順次いたします<wbr>（日曜日・祝日は<wbr>お休み）。<wbr>少しお時間を<wbr>いただく場合が<wbr>あります。</p>' : '') +
          '<button type="button" class="btn btn--line line-dialog__send" data-send>' +
          '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 3C6.48 3 2 6.58 2 11c0 2.47 1.4 4.68 3.6 6.15L5 21l4.06-2.25c.94.17 1.92.25 2.94.25 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/></svg>' +
          'LINEを開いて<wbr>送る</button>';
      }
    };

    // 「お試し無料レンタル中」のポップを押したときの最初の確認画面
    var renderRentalAsk = function () {
      dlg.classList.remove('is-wide');
      dlg.innerHTML = '<div class="line-dialog__body">' +
        '<div class="line-dialog__bar"><button type="button" class="line-dialog__close"><span aria-hidden="true">×</span>閉じる</button></div>' +
        '<p class="line-dialog__eyebrow">お試し無料レンタル</p>' +
        '<h2 class="line-dialog__title" id="line-dialog-title">乾太くんの<wbr>お試し<wbr>無料レンタルを<wbr>ご希望ですか？</h2>' +
        '<p class="line-dialog__lead">いくつかの質問に<wbr>お答えいただくと、<wbr>LINEで<wbr>ご相談いただけます。</p>' +
        '<div class="line-dialog__ask">' +
        '<button type="button" class="btn btn--line line-dialog__yes" data-rental-yes>はい、<wbr>無料レンタルを<wbr>希望します</button>' +
        '<button type="button" class="line-dialog__other" data-rental-other>ほかのご相談をする ›</button>' +
        '</div>' +
        '<p class="line-dialog__privacy">入力内容はこのサイトには保存されず、<wbr>LINEのメッセージとしてだけ<wbr>送られます。</p>' +
        '</div>';
      var yes = dlg.querySelector('[data-rental-yes]');
      if (yes) { yes.focus(); }
    };
    var render = function () {
      var list = steps();
      var key = list[stepIndex];
      var progress = key === 'confirm' ? '確認' : (stepIndex + 1) + ' / ' + (list.length - 1);
      dlg.innerHTML = '<div class="line-dialog__body">' +
        '<div class="line-dialog__bar"><button type="button" class="line-dialog__close"><span aria-hidden="true">×</span>閉じる</button></div>' +
        '<p class="line-dialog__eyebrow">LINEで相談<span class="line-dialog__step">' + progress + '</span></p>' +
        screens[key]() +
        (stepIndex > 0 ? '<button type="button" class="line-dialog__back" data-back>‹ 戻る</button>' : '') +
        (key === 'topic' ? '<p class="line-dialog__note"><a href="' + LINE_ADD_URL + '" target="_blank" rel="noopener">友だち追加だけする</a></p>' : '') +
        '<p class="line-dialog__privacy">入力内容はこのサイトには保存されず、<wbr>LINEのメッセージとしてだけ<wbr>送られます。</p>' +
        '</div>';
      // PC の確認画面は横に広げて QR コードを表示
      dlg.classList.toggle('is-wide', key === 'confirm' && !isTouch());
      if (key === 'confirm' && !isTouch()) { drawQr(); }
      focusFirst();
    };
    var focusFirst = function () {
      var first = dlg.querySelector('[data-rental-yes], .line-form:not([hidden]) .line-check__input, .line-form:not([hidden]) .line-form__input, .line-dialog__choice.is-selected, .line-dialog__choice, [data-send]');
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
      if (state.from === null || state.to === null) { return 'ご希望の時間帯を選んでください。'; }
      if (state.from < firstFrom(date)) { return 'その時間は過ぎています。別の時間を選んでください。'; }
      if (state.to - state.from < 60) { return '時間帯は1時間以上の幅で選んでください。'; }
      var digits = tel.replace(/[^0-9]/g, '');
      if (!/^0\d{9,10}$/.test(digits)) { return '電話番号を正しく入力してください。'; }
      return '';
    };

    dlg.addEventListener('click', function (e) {
      var t = e.target;
      if (t === dlg || t.closest('.line-dialog__close')) { dlg.close(); return; }
      // ポップから開いたときの確認：「はい」→ 無料レンタルとして地域の質問へ／「ほかのご相談」→ 相談内容を選ぶ画面へ
      if (t.closest('[data-rental-yes]')) { state.topic = 0; stepIndex = 1; render(); return; }
      if (t.closest('[data-rental-other]')) { stepIndex = 0; render(); return; }
      if (t.closest('[data-back]')) { go(-1); return; }
      if (t.closest('[data-send]')) { openLine(); dlg.close(); return; }
      // よくある質問：「この質問についてLINEで聞く」→ その質問を入れて次へ／「質問を入力してLINEで送る」→ 質問なしで次へ
      var ask = t.closest('[data-faq-ask]');
      if (ask) {
        var gi = ask.getAttribute('data-faq-ask').split('-');
        var q = FAQ[+gi[0]].items[+gi[1]].q.replace(/<[^>]+>/g, '').replace(/⁠/g, '');
        if (state.faqQ !== q) { state.detail = ''; }
        state.faqQ = q; go(1); return;
      }
      if (t.closest('[data-faq-free]')) { if (state.faqQ) { state.detail = ''; } state.faqQ = ''; go(1); return; }
      var key = steps()[stepIndex];
      var choice = t.closest('.line-dialog__choice');
      if (choice) {
        var v = +choice.getAttribute('data-value');
        if (key === 'topic') {
          if (state.topic !== v) { state.detail = ''; state.faqQ = ''; }
          state.topic = v; go(1);
        }
        else if (key === 'area') {
          state.area = LINE_AREAS[v];
          if (state.area === 'その他') { render(); } else { state.areaOther = ''; go(1); }
        } else if (key === 'method') { state.method = v === 0 ? 'LINE' : '電話'; go(1); }
        return;
      }
      if (t.closest('[data-next]')) {
        if (key === 'estimate') {
          var missing = '';
          for (var g = 0; g < LINE_ESTIMATE.length; g++) {
            var item = LINE_ESTIMATE[g];
            var picked = dlg.querySelector('input[name="lf-' + item.key + '"]:checked');
            state[item.key] = picked ? item.options[+picked.value] : '';
            if (!picked && !missing) { missing = item.label; }
          }
          if (missing) { showError(missing + 'を選んでください。'); } else { go(1); }
        }
        else if (key === 'detail') {
          state.detail = dlg.querySelector('#lf-detail').value.trim();
          if (state.topic === TOPIC_KNOW && !state.faqQ && !state.detail) { showError('ご質問をご記入ください。'); }
          else if (state.topic === TOPIC_OTHER && !state.detail) { showError('ご相談内容をご記入ください。'); }
          else { go(1); }
        }
        else if (key === 'area') { state.areaOther = dlg.querySelector('#lf-area').value.trim(); go(1); }
        else if (key === 'call') { var err = validateCall(); if (err) { showError(err); } else { go(1); } }
        else if (key === 'name') {
          state.name = dlg.querySelector('#lf-name').value.trim();
          if (!state.name) { showError('お名前を入力してください。'); } else { go(1); }
        }
      }
    });
    // 日付を選んだら開始時刻の候補を（今日なら過ぎた時間を除いて）作り直し、
    // 開始時刻を選んだら、終了時刻は1時間以上あとだけ選べるようにする
    dlg.addEventListener('change', function (e) {
      var fromSel = dlg.querySelector('#lf-from');
      var toSel = dlg.querySelector('#lf-to');
      if (!fromSel || !toSel) { return; }
      if (e.target.id === 'lf-date') {
        var first = firstFrom(e.target.value);
        var keepFrom = fromSel.value === '' || +fromSel.value < first ? null : +fromSel.value;
        fromSel.innerHTML = timeOptions(first, OPEN_TO - 60, keepFrom);
      }
      if (e.target.id === 'lf-date' || e.target.id === 'lf-from') {
        var from = fromSel.value === '' ? firstFrom(dlg.querySelector('#lf-date').value) : +fromSel.value;
        var keep = toSel.value === '' ? null : +toSel.value;
        if (keep !== null && keep - from < 60) { keep = null; }
        toSel.innerHTML = timeOptions(from + 60, OPEN_TO, keep);
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
        // 「お試し無料レンタル中」のポップから開いたときは、まず「無料レンタルをご希望ですか？」と確認する
        if (this.getAttribute('data-line-topic') !== null) { renderRentalAsk(); } else { render(); }
        dlg.showModal();
        focusFirst();
      });
    }
    // 機種のポップアップの「この機種のお見積りをLINEで依頼」：見積もりの画面を、機種を選んだ状態で開く
    openLineEstimate = function (option, name) {
      state = { topic: TOPIC_ESTIMATE, model: option, modelPick: { option: option, name: name } };
      stepIndex = 1;
      render();
      dlg.showModal();
      focusFirst();
    };
  }

  // ラインナップ：機種のカードを押すと、その機種のくわしい内容（価格・主な機能・主な仕様・注意書き）をポップアップで表示する。
  // 機能は「機能比較表」、仕様は「主な仕様」の表の、カードの data-cmp・data-spec 番目（0から数える）の列から作るので、
  // 表やカードを直せばポップアップの中身も変わる。
  var productCards = document.querySelectorAll('.product[data-cmp]');
  if (productCards.length && typeof HTMLDialogElement === 'function') {
    var pdlg = document.createElement('dialog');
    pdlg.className = 'line-dialog product-dialog';
    pdlg.setAttribute('aria-labelledby', 'pd-title');
    document.body.appendChild(pdlg);
    var pdCard = null;

    // 表の本体を「行ごとの [見出しのセル, 列ごとのセル…]」にする（横につながったセル colspan は列の数だけ繰り返す）
    var tableRows = function (sel) {
      var table = document.querySelector(sel);
      var rows = [];
      if (!table || !table.tBodies[0]) { return rows; }
      var trs = table.tBodies[0].rows;
      for (var r = 0; r < trs.length; r++) {
        var cells = [];
        for (var c = 1; c < trs[r].cells.length; c++) {
          for (var s = 0; s < (trs[r].cells[c].colSpan || 1); s++) { cells.push(trs[r].cells[c]); }
        }
        rows.push({ head: trs[r].cells[0], cells: cells });
      }
      return rows;
    };
    var plain = function (el) { return el.textContent.replace(/[⁠\s]/g, ''); };
    // 機能比較表の下の「※1 …　※2 …」を番号ごとに分ける
    var cmpNotes = {};
    var cmpNoteEls = document.querySelectorAll('#compare .note p');
    for (var cn = 0; cn < cmpNoteEls.length; cn++) {
      var parts = cmpNoteEls[cn].innerHTML.split(/(?=※⁠?\d)/);
      for (var cp = 0; cp < parts.length; cp++) {
        var mm = parts[cp].match(/^※⁠?(\d)/);
        if (mm) { cmpNotes[mm[1]] = parts[cp].replace(/[\s　]+$/, ''); }
      }
    }
    var supNums = function (el, used) {
      var sups = el.querySelectorAll('sup');
      for (var i = 0; i < sups.length; i++) { var n = sups[i].textContent.replace(/\D/g, ''); if (n && used.indexOf(n) === -1) { used.push(n); } }
    };
    // 仕様の表のうち、ポップアップに出さない行（型式は見出しに出す。都市ガス用の数値は、当店エリアでは使わないので出さない）
    var SPEC_SKIP = /^(型式|ガス消費量（13A）|ガス消費量（12A）|対応ガス種)/;

    var renderProduct = function (card) {
      var ci = +card.getAttribute('data-cmp');
      var si = +card.getAttribute('data-spec');
      var section = card.closest('section');
      var grid = card.closest('.product-grid');
      var typeName = section.querySelector('.section-title') ? plain(section.querySelector('.section-title')) : '';
      var sub = '';
      for (var p = grid.previousElementSibling; p; p = p.previousElementSibling) {
        if (p.matches('h3.sub-title')) { sub = plain(p); break; }
        if (p.matches('.section-head')) { break; }
      }
      var lead = grid.previousElementSibling && grid.previousElementSibling.tagName === 'P' ? grid.previousElementSibling.innerHTML : '';
      var after = grid.nextElementSibling && grid.nextElementSibling.matches('p.note') ? grid.nextElementSibling.innerHTML : '';
      var q = function (s) { var el = card.querySelector(s); return el ? el.innerHTML : ''; };
      var img = card.querySelector('.product__img');

      var used = [];
      var feats = '';
      var cr = tableRows('#compare table');
      for (var r = 0; r < cr.length; r++) {
        var cell = cr[r].cells[ci];
        if (!cell) { continue; }
        supNums(cr[r].head, used); supNums(cell, used);
        var yes = cell.classList.contains('yes');
        var no = cell.classList.contains('no');
        var mark = yes ? '<span class="pd-feat__mark" aria-hidden="true">✓</span>' : no ? '<span class="pd-feat__mark" aria-hidden="true">−</span>' : '<span class="pd-feat__mark" aria-hidden="true">✓</span>';
        var sups = cell.querySelectorAll('sup');
        var supHtml = '';
        for (var u = 0; u < sups.length; u++) { supHtml += sups[u].outerHTML; }
        feats += '<li class="pd-feat ' + (no ? 'is-no' : 'is-yes') + '">' + mark +
          '<span class="pd-feat__name">' + cr[r].head.innerHTML + supHtml +
          (no ? '<span class="sr-only">：非搭載</span>' : yes ? '<span class="sr-only">：搭載</span>' : '：' + cell.textContent) + '</span></li>';
      }
      var specs = '';
      var sr = tableRows('#spec table');
      for (var r2 = 0; r2 < sr.length; r2++) {
        if (!sr[r2].cells[si] || SPEC_SKIP.test(plain(sr[r2].head))) { continue; }
        var head = sr[r2].head.innerHTML.replace('<br>（LPG）', '<br><span class="nw">（プロパンガス）</span>').replace(/<br>(?!<span)/g, '');
        specs += '<div><dt>' + head + '</dt><dd>' + sr[r2].cells[si].innerHTML + '</dd></div>';
      }
      var notes = '';
      used.sort();
      for (var nn = 0; nn < used.length; nn++) { if (cmpNotes[used[nn]]) { notes += '<p>' + cmpNotes[used[nn]] + '</p>'; } }

      pdlg.innerHTML =
        '<div class="line-dialog__body pd">' +
          '<div class="line-dialog__bar"><button type="button" class="line-dialog__close"><span aria-hidden="true">×</span>閉じる</button></div>' +
          '<p class="pd__type">' + typeName + (sub ? '<span>' + sub + '</span>' : '') + '</p>' +
          '<div class="pd__head">' +
            (img ? '<img class="pd__img" src="' + img.getAttribute('src') + '" alt="' + img.getAttribute('alt') + '" width="' + img.getAttribute('width') + '" height="' + img.getAttribute('height') + '">' : '') +
            '<div class="pd__info">' +
              '<p class="product__cap">' + q('.product__cap') + '</p>' +
              '<h2 class="pd__model" id="pd-title">' + q('.product__model') + '</h2>' +
              '<p class="product__sub">' + q('.product__sub') + '</p>' +
              '<ul class="product__tags">' + q('.product__tags') + '</ul>' +
            '</div>' +
          '</div>' +
          (lead ? '<p class="pd__lead">' + lead + '</p>' : '') +
          '<div class="pd__price"><p class="product__price">' + q('.product__price') + '</p>' + (card.querySelector('.price-deal') ? '<p class="price-deal">' + q('.price-deal') + '</p>' : '') + '</div>' +
          '<div class="pd__actions"><button type="button" class="btn btn--line" data-pd-estimate>この機種の<wbr>お見積りを<wbr>LINEで依頼</button></div>' +
          '<h3 class="pd__h">主な機能</h3><ul class="pd-feats">' + feats + '</ul>' +
          '<h3 class="pd__h">主な仕様</h3><dl class="pd-spec">' + specs + '</dl>' +
          '<div class="pd__notes">' + (after ? '<p>' + after + '</p>' : '') + notes +
            '<p>価格は<wbr>メーカー希望小売価格です。<wbr>配送費・据付工事費などは<wbr>含まれません。</p></div>' +
          '<div class="pd__actions"><button type="button" class="btn btn--line" data-pd-estimate>この機種の<wbr>お見積りを<wbr>LINEで依頼</button>' +
          '<button type="button" class="btn btn--outline pd__close2" data-pd-close>閉じる</button></div>' +
        '</div>';
      pdlg.scrollTop = 0;
    };

    var openProduct = function (card) {
      pdCard = card;
      renderProduct(card);
      pdlg.showModal();
      pdlg.querySelector('.line-dialog__close').focus();
    };
    var cardClick = function (e) {
      if (e.target.closest('a')) { return; }
      // 文字を選んでいるとき（コピーしたいとき）は開かない
      if (window.getSelection && String(window.getSelection())) { return; }
      openProduct(this);
    };
    for (var pc = 0; pc < productCards.length; pc++) {
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'product__more';
      more.innerHTML = 'くわしく見る<span aria-hidden="true">＋</span>';
      productCards[pc].querySelector('.product__body').appendChild(more);
      productCards[pc].addEventListener('click', cardClick);
    }
    pdlg.addEventListener('click', function (e) {
      var t = e.target;
      if (t === pdlg || t.closest('.line-dialog__close') || t.closest('[data-pd-close]')) { pdlg.close(); return; }
      if (t.closest('[data-pd-estimate]') && pdCard) {
        var cap = pdCard.querySelector('.product__cap');
        var section = pdCard.closest('section');
        var option = (section && section.id === 'deluxe' ? 'デラックス ' : 'スタンダード ') + (cap ? cap.textContent.replace(/\s/g, '') : '');
        var name = plain(pdCard.querySelector('.product__model'));
        pdlg.close();
        if (openLineEstimate) { openLineEstimate(option, name); } else { window.open(LINE_ADD_URL, '_blank', 'noopener'); }
      }
    });
  }

  // 動画：PCは押したときに初めてYouTubeを読み込んで再生（ページを重くしない）。
  // スマホは音の出る自動再生ができないため、最初からYouTubeのプレーヤーを置き、その再生ボタンで再生する
  var ytFrame = function (btn, autoplay) {
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube.com/embed/' + btn.getAttribute('data-yt') + '?rel=0&playsinline=1&cc_load_policy=0&enablejsapi=1' + (autoplay ? '&autoplay=1' : '');
    f.title = btn.getAttribute('data-yt-title') || 'YouTube動画';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.setAttribute('allowfullscreen', '');
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    if (!autoplay) { f.loading = 'lazy'; }
    // 字幕は出さない（音なしで自動再生されたときなど、YouTubeが字幕を自動で出すため、読み込み後に消す）
    f.addEventListener('load', function () {
      var n = 0;
      var t = setInterval(function () {
        if (!f.contentWindow || ++n > 16) { clearInterval(t); return; }
        f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'unloadModule', args: ['captions'] }), '*');
      }, 500);
    });
    btn.parentNode.replaceChild(f, btn);
    return f;
  };
  // スマホ：YouTubeのタイトル・共有・「YouTubeで見る」を隠すため、プレーヤーの上にサムネイルと白い再生ボタンをかぶせる。
  // かぶせた絵は押せない（タップは下のYouTubeの再生ボタンに届く）。上下の帯はYouTubeのリンクを押さないようにふさぐ。
  // 再生が始まったら絵を外す。YouTubeから返事が来ないときは、絵を外して普通のプレーヤーに戻す
  var ytCover = function (btn) {
    var wrap = document.createElement('div');
    wrap.className = 'video__frame';
    btn.parentNode.insertBefore(wrap, btn);
    var f = ytFrame(btn, false);
    wrap.appendChild(f);
    btn.tabIndex = -1;
    btn.setAttribute('aria-hidden', 'true');
    wrap.appendChild(btn);
    var send = function (msg) { if (f.contentWindow) { f.contentWindow.postMessage(JSON.stringify(msg), '*'); } };
    var done = function () { wrap.classList.add('is-playing'); };
    ['top', 'bottom'].forEach(function (pos) {
      var g = document.createElement('span');
      g.className = 'video__guard video__guard--' + pos;
      g.setAttribute('aria-hidden', 'true');
      g.addEventListener('click', function () { send({ event: 'command', func: 'playVideo', args: [] }); });
      wrap.appendChild(g);
    });
    var heard = false;
    window.addEventListener('message', function (ev) {
      if (ev.source !== f.contentWindow || typeof ev.data !== 'string') { return; }
      var d;
      try { d = JSON.parse(ev.data); } catch (e) { return; }
      heard = true;
      var st = d.event === 'onStateChange' ? d.info : (d.info && d.info.playerState);
      if (st === 1 || st === 3) { done(); }
    });
    f.addEventListener('load', function () {
      var n = 0;
      var t = setInterval(function () {
        if (heard || ++n > 12) { clearInterval(t); if (!heard) { done(); } return; }
        send({ event: 'listening', id: 'yt' + btn.getAttribute('data-yt'), channel: 'widget' });
      }, 500);
    });
  };
  var ytTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  var ytButtons = document.querySelectorAll('.video__play[data-yt]');
  for (var y = 0; y < ytButtons.length; y++) {
    if (ytTouch) { ytCover(ytButtons[y]); continue; }
    ytButtons[y].addEventListener('click', function () { ytFrame(this, true).focus(); });
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

  // 横にスクロールできる表：はみ出しているときだけ案内と右端の目印を出す。
  // 表が最初に画面に入ったとき、一度だけ少し横に動かして「動かせる」ことを見せる
  var scrollers = document.querySelectorAll('.table-scroll');
  if (scrollers.length) {
    document.documentElement.classList.add('js-tables');
    var updateScroller = function (box) {
      var wrap = box.querySelector('.table-wrap');
      var more = wrap.scrollWidth > wrap.clientWidth + 4;
      box.classList.toggle('has-more', more);
      box.classList.toggle('is-end', wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 4);
      var hint = box.previousElementSibling;
      if (hint && hint.classList.contains('table-hint')) { hint.classList.toggle('is-needed', more); }
    };
    Array.prototype.forEach.call(scrollers, function (box) {
      box.querySelector('.table-wrap').addEventListener('scroll', function () { updateScroller(box); }, { passive: true });
      updateScroller(box);
    });
    window.addEventListener('resize', function () { Array.prototype.forEach.call(scrollers, updateScroller); });
    if (!reduceMotion && 'IntersectionObserver' in window) {
      var nudge = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) { return; }
          nudge.unobserve(entry.target);
          var wrap = entry.target.querySelector('.table-wrap');
          if (!entry.target.classList.contains('has-more') || wrap.scrollLeft > 0) { return; }
          setTimeout(function () {
            wrap.scrollTo({ left: 80, behavior: 'smooth' });
            setTimeout(function () { wrap.scrollTo({ left: 0, behavior: 'smooth' }); }, 750);
          }, 500);
        });
      }, { threshold: 0.4 });
      Array.prototype.forEach.call(scrollers, function (box) { nudge.observe(box); });
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
