(function () {
  'use strict';
  var SHOP = window.SHOP, PARTS = window.PARTS;
  var app = document.getElementById('app');
  var CART_KEY = 'parts_cart_v1';
  // لو قاعدة البيانات مربوطة فى config.js القطع تتقرأ منها، وإلا تظهر القطع التجريبية
  var db = (SHOP.supabaseUrl && SHOP.supabaseKey && window.supabase) ? window.supabase.createClient(SHOP.supabaseUrl, SHOP.supabaseKey) : null;
  var filters = { q: '', brand: '', model: '', year: '', category: '', condition: '', hideSold: false };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return Number(n).toLocaleString('en-US') + ' ج.م'; }
  function byId(id) { return PARTS.filter(function (p) { return p.id === id; })[0]; }
  function uniq(list) { return list.filter(function (v, i) { return v && list.indexOf(v) === i; }).sort(); }
  // صورة القطعة: لو مفيش صور يظهر الرمز المؤقت
  function picHtml(p, i) {
    var src = p.images && p.images[i || 0];
    return '<div class="pic">' + (src ? '<img loading="lazy" src="' + esc(src) + '" alt="' + esc(p.name) + '">' : esc(p.icon || '🔩')) + '</div>';
  }
  var ICONS = {
    pin: 'M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.800 7-13a7 7 0 0 0-7-7zm0 9.500a2.500 2.500 0 1 1 0-5 2.500 2.500 0 0 1 0 5z',
    fb: 'M13.500 22v-8h2.700l.400-3.200h-3.100V8.800c0-.900.300-1.600 1.600-1.600h1.700V4.300c-.300 0-1.300-.100-2.400-.100-2.400 0-4 1.500-4 4.100v2.500H7.700V14h2.700v8h3.100z',
    phone: 'M6.600 10.800a15.100 15.100 0 0 0 6.600 6.600l2.200-2.200c.300-.300.700-.400 1-.200 1.100.400 2.300.600 3.600.600.600 0 1 .400 1 1V20c0 .600-.400 1-1 1A17 17 0 0 1 3 4c0-.600.400-1 1-1h3.500c.600 0 1 .400 1 1 0 1.300.200 2.500.600 3.600.100.300 0 .700-.200 1l-2.300 2.200z',
    wa: 'M12 2a10 10 0 0 0-8.600 15.100L2 22l5-1.300A10 10 0 1 0 12 2zm5 14.200c-.200.600-1.200 1.100-1.700 1.200-.500.100-1 .200-3.300-.700-2.700-1.100-4.400-3.900-4.600-4.100-.100-.200-1.100-1.500-1.100-2.800s.700-2 .900-2.300c.200-.200.500-.300.700-.300h.500c.200 0 .400 0 .600.500l.800 2c.100.200.100.400 0 .500-.300.600-.700.800-.500 1.200.800 1.300 1.600 1.800 2.800 2.400.200.100.400.100.500-.100l.800-1c.200-.200.300-.200.600-.100l1.800.900c.200.100.400.200.400.300.100.100.100.600-.200 1.400z',
    clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.400 3.300 2-.800 1.300L11 13V7h2v5.400z',
  };
  function ic(name) { return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="' + ICONS[name] + '"/></svg>'; }
  function ext(href) { return ' target="_blank" rel="noopener" href="' + esc(href) + '"'; }
  // أزرار الوصول السريع تحت الكفر
  function quickHtml() {
    return '<nav class="quick" id="sec-contact">' +
      '<a class="q q-map"' + ext(SHOP.mapLink) + '><span class="qi">' + ic('pin') + '</span><span><strong>موقع المحل</strong><small>افتح الخريطة</small></span></a>' +
      '<a class="q q-fb"' + ext(SHOP.facebook) + '><span class="qi">' + ic('fb') + '</span><span><strong>صفحة فيسبوك</strong><small>تابع الجديد</small></span></a>' +
      '<a class="q q-wa"' + ext('https://wa.me/' + SHOP.whatsapp[0]) + '><span class="qi">' + ic('wa') + '</span><span><strong>واتساب</strong><small>راسلنا الآن</small></span></a>' +
      '<a class="q q-call" href="tel:' + esc(SHOP.phones[0].number) + '"><span class="qi">' + ic('phone') + '</span><span><strong>اتصل بنا</strong><small><bdi dir="ltr">' + esc(SHOP.phones[0].number) + '</bdi></small></span></a>' +
      '</nav>';
  }
  // قسم العنوان والخريطة وبيانات التواصل
  function contactHtml() {
    return '<section class="contact"><h2>زورنا وتواصل معنا</h2><div class="contact-grid' + (SHOP.mapQuery ? '' : ' no-map') + '">' +
      (SHOP.mapQuery ? '<div class="map"><iframe title="موقع المحل على الخريطة" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://www.google.com/maps?q=' + encodeURIComponent(SHOP.mapQuery) + '&z=16&hl=ar&output=embed"></iframe></div>' : '') +
      '<div class="info">' +
      '<div class="irow"><span class="qi q-map">' + ic('pin') + '</span><div><strong>العنوان</strong><div>' + esc(SHOP.address) + '</div></div></div>' +
      (SHOP.hours ? '<div class="irow"><span class="qi q-time">' + ic('clock') + '</span><div><strong>مواعيد العمل</strong><div>' + esc(SHOP.hours) + '</div></div></div>' : '') +
      '<div class="irow"><span class="qi q-call">' + ic('phone') + '</span><div><strong>التليفونات</strong>' + SHOP.phones.map(function (p) {
        return '<div>' + esc(p.label) + ': <a href="tel:' + esc(p.number) + '"><bdi dir="ltr">' + esc(p.number) + '</bdi></a></div>';
      }).join('') + '</div></div>' +
      '</div></div></section>';
  }
  // زر واتساب لكل رقم من أرقام المحل
  function waButtons(text, label) {
    return SHOP.whatsapp.map(function (n) {
      return '<a class="btn wa block" target="_blank" rel="noopener" href="' + esc('https://wa.me/' + n + '?text=' + encodeURIComponent(text)) + '">' +
        label + ' <bdi dir="ltr">0' + esc(n.slice(2)) + '</bdi></a>';
    }).join('');
  }

  // ---------- السلة ----------
  function getCart() {
    var ids = [];
    try { ids = JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { ids = []; }
    // القطعة المباعة أو المحذوفة تخرج من السلة
    return ids.filter(function (id) { var p = byId(id); return p && !p.sold; });
  }
  function setCart(ids) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(ids)); } catch (e) { /* تجاهل */ }
    document.getElementById('cartCount').textContent = ids.length;
  }
  function addToCart(id) { var c = getCart(); if (c.indexOf(id) < 0) c.push(id); setCart(c); }
  function removeFromCart(id) { setCart(getCart().filter(function (x) { return x !== id; })); }
  function cartTotal() { return getCart().reduce(function (s, id) { return s + byId(id).price; }, 0); }

  // ---------- الكتالوج ----------
  function options(list, selected, first) {
    return '<option value="">' + first + '</option>' + list.map(function (v) {
      return '<option' + (String(v) === String(selected) ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');
  }
  function matches(p) {
    var f = filters;
    if (f.hideSold && p.sold) return false;
    if (f.brand && p.brand !== f.brand) return false;
    if (f.model && p.model !== f.model) return false;
    if (f.category && p.category !== f.category) return false;
    if (f.condition && p.condition !== f.condition) return false;
    if (f.year && (!p.yearFrom || Number(f.year) < p.yearFrom || Number(f.year) > p.yearTo)) return false;
    if (f.q) {
      var hay = [p.name, p.brand, p.model, p.category, p.id].join(' ').toLowerCase();
      if (hay.indexOf(f.q.trim().toLowerCase()) < 0) return false;
    }
    return true;
  }
  function cardHtml(p) {
    return '<a class="card' + (p.sold ? ' is-sold' : '') + '" href="#/part/' + esc(p.id) + '">' +
      (p.sold ? '<span class="sold-ribbon">تم البيع</span>' : '') +
      picHtml(p) + '<div class="body">' +
      '<h3>' + esc(p.name) + '</h3>' +
      '<div class="meta">' + esc(p.brand) + ' ' + esc(p.model) + '</div>' + (p.yearFrom ? '<div class="meta">موديل ' + p.yearFrom + ' إلى ' + p.yearTo + '</div>' : '') +
      '<div class="meta">الحالة: ' + esc(p.condition) + '</div>' +
      '<div class="price">' + money(p.price) + '</div></div></a>';
  }
  function renderList() {
    var list = PARTS.filter(matches);
    document.getElementById('list').innerHTML = list.length
      ? '<div class="grid">' + list.map(cardHtml).join('') + '</div>'
      : '<div class="empty">لا توجد قطع مطابقة للبحث</div>';
    document.getElementById('count').textContent = 'عدد القطع: ' + list.length;
  }
  function viewHome() {
    var years = [];
    PARTS.forEach(function (p) { if (p.yearFrom) for (var y = p.yearFrom; y <= p.yearTo; y++) years.push(y); });
    var models = PARTS.filter(function (p) { return !filters.brand || p.brand === filters.brand; }).map(function (p) { return p.model; });
    app.innerHTML =
      '<section class="hero' + (SHOP.cover ? ' has-cover" style="background-image:linear-gradient(to top, rgba(12,18,26,.92) 0%, rgba(12,18,26,.35) 55%, rgba(12,18,26,.15) 100%), url(\'' + esc(encodeURI(SHOP.cover)) + '\')' : '') + '"><h1>' + esc(SHOP.name) + '</h1><p>' + esc(SHOP.tagline) + '</p></section>' +
      quickHtml() + '<div class="sec-head offers" id="sec-offers"><h2>عروض حسام الدين</h2></div>' +
      '<section class="filters">' +
      '<input class="wide" id="f-q" type="search" placeholder="ابحث باسم القطعة أو الموديل" value="' + esc(filters.q) + '">' +
      '<details class="wide"' + (filters.brand || filters.model || filters.year || filters.category || filters.condition || filters.hideSold ? ' open' : '') + '><summary>فلترة بالماركة والموديل والسنة</summary><div class="fgrid">' +
      '<select id="f-brand">' + options(uniq(PARTS.map(function (p) { return p.brand; })), filters.brand, 'كل الماركات') + '</select>' +
      '<select id="f-model">' + options(uniq(models), filters.model, 'كل الموديلات') + '</select>' +
      '<select id="f-year">' + options(uniq(years).reverse(), filters.year, 'سنة الصنع') + '</select>' +
      '<select id="f-category">' + options(uniq(PARTS.map(function (p) { return p.category; })), filters.category, 'نوع القطعة') + '</select>' +
      '<select id="f-condition">' + options(uniq(PARTS.map(function (p) { return p.condition; })), filters.condition, 'الحالة') + '</select>' +
      '<label class="check wide"><input id="f-hideSold" type="checkbox"' + (filters.hideSold ? ' checked' : '') + '> إخفاء القطع المباعة</label>' +
      '</div></details></section><div class="count" id="count"></div><div id="list"></div>' +
      (SHOP.gallery && SHOP.gallery.length ? '<section class="tour" id="sec-tour"><div class="sec-head"><h2>جولة داخل المحل</h2><a href="#/gallery">عرض كل الصور ←</a></div>' +
        '<div class="strip">' + SHOP.gallery.map(function (s) {
          return '<a href="#/gallery"><img loading="lazy" src="' + esc(s) + '" alt="صورة من المحل"></a>';
        }).join('') + '</div></section>' : '') +
      contactHtml();
    renderList();
    document.getElementById('f-q').addEventListener('input', function (e) { filters.q = e.target.value; renderList(); });
    ['brand', 'model', 'year', 'category', 'condition'].forEach(function (k) {
      document.getElementById('f-' + k).addEventListener('change', function (e) {
        filters[k] = e.target.value;
        if (k === 'brand') { filters.model = ''; viewHome(); } else renderList();
      });
    });
    document.getElementById('f-hideSold').addEventListener('change', function (e) { filters.hideSold = e.target.checked; renderList(); });
  }

  // ---------- صفحة القطعة ----------
  function viewPart(id) {
    var p = byId(id);
    if (!p) { app.innerHTML = '<div class="empty">القطعة غير موجودة</div>'; return; }
    var inCart = getCart().indexOf(p.id) >= 0;
    var ask = 'السلام عليكم، عاوز أسأل عن القطعة دى:\n' + p.name + ' — ' + p.brand + ' ' + p.model +
      (p.yearFrom ? ' (' + p.yearFrom + ' إلى ' + p.yearTo + ')' : '') + '\nكود القطعة: ' + p.id + '\nالسعر: ' + money(p.price);
    app.innerHTML = '<a class="back" href="#/">→ رجوع للقطع</a>' +
      '<div class="detail' + (p.sold ? ' is-sold' : '') + '"><div class="gallery">' + (p.images && p.images.length ? p.images.map(function (s, i) { return picHtml(p, i); }).join('') : picHtml(p)) + '</div>' +
      '<div class="panel"><h2>' + esc(p.name) + '</h2>' +
      '<span class="tag' + (p.sold ? ' sold' : '') + '">' + (p.sold ? 'تم البيع' : 'متاحة') + '</span>' +
      '<div class="price" style="font-size:24px;margin-top:6px">' + money(p.price) + '</div>' +
      '<ul class="specs">' +
      '<li><span>الماركة</span><span>' + esc(p.brand) + '</span></li>' +
      '<li><span>الموديل</span><span>' + esc(p.model) + '</span></li>' +
      (p.yearFrom ? '<li><span>سنوات الصنع</span><span>من ' + p.yearFrom + ' إلى ' + p.yearTo + '</span></li>' : '') +
      '<li><span>نوع القطعة</span><span>' + esc(p.category) + '</span></li>' +
      '<li><span>الحالة</span><span>' + esc(p.condition) + '</span></li>' +
      '<li><span>كود القطعة</span><span>' + esc(p.id) + '</span></li></ul>' +
      '<p>' + esc(p.desc) + '</p><div class="stack">' +
      (p.sold ? '<button class="btn block" disabled>القطعة اتباعت</button>'
        : inCart ? '<a class="btn block" href="#/cart">القطعة فى السلة — اذهب للسلة</a>'
          : '<button class="btn block" id="add">أضف إلى السلة 🛒</button>') +
      waButtons(ask, 'اسأل عنها على واتساب') +
      '</div></div></div>';
    var add = document.getElementById('add');
    if (add) add.addEventListener('click', function () { addToCart(p.id); viewPart(p.id); });
  }

  // ---------- السلة ----------
  function cartRows(withRemove) {
    return getCart().map(function (id) {
      var p = byId(id);
      return '<div class="row"><div><strong>' + esc(p.name) + '</strong><div class="meta">' + esc(p.brand) + ' ' + esc(p.model) + ' · ' + esc(p.id) + '</div></div>' +
        '<div style="text-align:left"><div class="price">' + money(p.price) + '</div>' +
        (withRemove ? '<button class="btn ghost small" data-remove="' + esc(p.id) + '">حذف</button>' : '') + '</div></div>';
    }).join('');
  }
  function viewCart() {
    if (!getCart().length) {
      app.innerHTML = '<div class="empty">السلة فاضية<br><br><a class="btn" href="#/">تصفح القطع</a></div>';
      return;
    }
    app.innerHTML = '<h2>سلة الشراء</h2><div class="panel">' + cartRows(true) +
      '<div class="row total"><span>الإجمالى</span><span>' + money(cartTotal()) + '</span></div>' +
      '<div class="meta">مصاريف الشحن تتحدد مع المحل حسب المحافظة</div></div>' +
      '<a class="btn block" href="#/checkout">إتمام الطلب</a>';
    app.querySelectorAll('[data-remove]').forEach(function (b) {
      b.addEventListener('click', function () { removeFromCart(b.getAttribute('data-remove')); viewCart(); });
    });
  }

  // ---------- إتمام الطلب ----------
  var PAY = {
    cod: 'الدفع عند الاستلام',
    transfer: 'تحويل إنستاباى',
    pickup: 'الاستلام والدفع فى المحل',
  };
  function viewCheckout() {
    if (!getCart().length) { location.hash = '#/cart'; return; }
    app.innerHTML = '<a class="back" href="#/cart">→ رجوع للسلة</a><h2>إتمام الطلب</h2>' +
      '<div class="panel">' + cartRows(false) + '<div class="row total"><span>الإجمالى</span><span>' + money(cartTotal()) + '</span></div></div>' +
      '<form class="panel" id="order" novalidate>' +
      '<label class="field"><span>الاسم</span><input name="name" autocomplete="name"></label>' +
      '<label class="field"><span>رقم الموبايل</span><input name="phone" type="tel" inputmode="numeric" placeholder="01xxxxxxxxx"></label>' +
      '<label class="field"><span>المحافظة</span><input name="city"></label>' +
      '<label class="field"><span>العنوان بالتفصيل</span><textarea name="address" rows="2"></textarea></label>' +
      '<label class="field"><span>ملاحظات (اختيارى)</span><textarea name="notes" rows="2"></textarea></label>' +
      '<h3>طريقة الدفع</h3><div class="pay">' +
      '<label><input type="radio" name="pay" value="cod" checked><span>' + PAY.cod + '</span></label>' +
      '<label><input type="radio" name="pay" value="transfer"><span>' + PAY.transfer + '<br><span class="meta">' + (SHOP.transferNumber ? 'حوّل على الرقم ' + esc(SHOP.transferNumber) + ' وابعت صورة الإيصال على الواتساب' : 'المحل هيبعت لك رقم التحويل على الواتساب بعد تأكيد الطلب') + '</span></span></label>' +
      '<label><input type="radio" name="pay" value="pickup"><span>' + PAY.pickup + '</span></label>' +
      '</div><div class="err" id="err"></div>' +
      '<button class="btn block" type="submit">تأكيد الطلب</button></form>';
    document.getElementById('order').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, err = document.getElementById('err');
      var d = { name: f.name.value.trim(), phone: f.phone.value.trim(), city: f.city.value.trim(), address: f.address.value.trim(), notes: f.notes.value.trim(), pay: f.pay.value };
      if (!d.name || !d.city || !d.address) { err.textContent = 'من فضلك اكتب الاسم والمحافظة والعنوان'; return; }
      if (!/^01[0125]\d{8}$/.test(d.phone)) { err.textContent = 'رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01'; return; }
      if (!db) { viewDone(d, 'T' + Date.now().toString().slice(-7)); return; }
      var btn = f.querySelector('button[type=submit]');
      btn.disabled = true; err.textContent = 'جارى تسجيل الطلب...';
      db.rpc('place_order', {
        p_name: d.name, p_phone: d.phone, p_city: d.city, p_address: d.address, p_notes: d.notes, p_pay: d.pay,
        p_part_ids: getCart().map(function (id) { return byId(id).dbId; }),
      }).then(function (res) {
        if (res.error) { btn.disabled = false; err.textContent = 'تعذر تسجيل الطلب: ' + res.error.message; return; }
        viewDone(d, String(res.data));
      });
    });
  }
  function viewDone(d, no) {
    var lines = getCart().map(function (id) { var p = byId(id); return '- ' + p.name + ' (' + p.brand + ' ' + p.model + ') كود ' + p.id + ' — ' + money(p.price); });
    var msg = 'طلب جديد رقم ' + no + '\n' + lines.join('\n') + '\nالإجمالى: ' + money(cartTotal()) +
      '\n\nالاسم: ' + d.name + '\nالموبايل: ' + d.phone + '\nالمحافظة: ' + d.city + '\nالعنوان: ' + d.address +
      '\nطريقة الدفع: ' + PAY[d.pay] + (d.notes ? '\nملاحظات: ' + d.notes : '');
    var total = money(cartTotal());
    setCart([]);
    app.innerHTML = '<div class="panel" style="text-align:center"><div style="font-size:48px">✅</div>' +
      '<h2>طلبك جاهز للإرسال</h2><p>رقم الطلب: <strong>' + no + '</strong> — الإجمالى: <strong>' + total + '</strong></p>' +
      '<p class="meta">اضغط الزر عشان تبعت الطلب للمحل على الواتساب، والمحل هيأكد معاك التوفر والشحن.</p>' +
      '<div class="stack">' + waButtons(msg, 'إرسال الطلب على واتساب') +
      '<a class="btn ghost block" href="#/">رجوع للقطع</a></div></div>';
  }

  // ---------- معرض المحل ----------
  function viewGallery() {
    var pics = (SHOP.cover ? [SHOP.cover] : []).concat(SHOP.gallery || []);
    app.innerHTML = '<a class="back" href="#/">→ رجوع للرئيسية</a>' +
      '<div class="sec-head"><h2>جولة داخل المحل</h2></div>' +
      '<p class="meta" style="margin-top:-4px">صور من داخل ' + esc(SHOP.name) + ' — اضغط على أى صورة لتكبيرها</p>' +
      '<div class="gal">' + pics.map(function (s, i) {
        return '<button type="button" data-i="' + i + '"><img loading="lazy" src="' + esc(s) + '" alt="صورة من المحل"></button>';
      }).join('') + '</div>' +
      '<div class="cta" style="margin-top:16px"><a class="btn" href="#/">تصفح القطع المعروضة</a></div>';
    app.querySelectorAll('.gal button').forEach(function (b) {
      b.addEventListener('click', function () {
        var box = document.createElement('div');
        box.className = 'lightbox';
        box.innerHTML = '<img src="' + esc(pics[Number(b.getAttribute('data-i'))]) + '" alt="صورة من المحل"><span>إغلاق ✕</span>';
        box.addEventListener('click', function () { box.remove(); });
        document.body.appendChild(box);
      });
    });
  }

  // ---------- التنقل ----------
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    window.scrollTo(0, 0);
    if (h.indexOf('part/') === 0) viewPart(decodeURIComponent(h.slice(5)));
    else if (h === 'cart') viewCart();
    else if (h === 'checkout') viewCheckout();
    else if (h === 'gallery') viewGallery();
    else viewHome();
    if (pendingSection) {
      var el = document.getElementById(pendingSection);
      pendingSection = null;
      if (el) el.scrollIntoView();
    }
  }

  // ---------- القائمة الجانبية ----------
  var pendingSection = null;
  var MENU = [
    { id: 'sec-contact', label: 'التواصل', icon: 'phone' },
    { id: 'sec-offers', label: 'عروض حسام الدين', icon: 'tag' },
    { id: 'sec-tour', label: 'جولة داخل المحل', icon: 'photo' },
  ];
  ICONS.tag = 'M21.400 11.600l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .500.200 1 .600 1.400l9 9a2 2 0 0 0 2.800 0l7-7a2 2 0 0 0 0-2.800zM6.500 8A1.500 1.500 0 1 1 6.500 5a1.500 1.500 0 0 1 0 3z';
  ICONS.photo = 'M21 5H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM8 8.500a1.500 1.500 0 1 1 0 3 1.500 1.500 0 0 1 0-3zM4 17l4.500-4.500 2.500 2.500 4-5 5 7H4z';
  function closeMenu() { document.body.classList.remove('menu-open'); }
  function goSection(id) {
    closeMenu();
    var onHome = !location.hash.replace(/^#\/?/, '');
    if (onHome) { var el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth' }); }
    else { pendingSection = id; location.hash = '#/'; }
  }
  (function buildMenu() {
    var d = document.createElement('div');
    d.innerHTML = '<div class="backdrop"></div><aside class="drawer" aria-label="القائمة">' +
      '<div class="drawer-head"><strong>' + esc(SHOP.name) + '</strong><button type="button" class="drawer-close" aria-label="إغلاق القائمة">✕</button></div>' +
      MENU.map(function (m) { return '<button type="button" class="mitem" data-go="' + m.id + '"><span class="qi">' + ic(m.icon) + '</span>' + m.label + '</button>'; }).join('') +
      '</aside>';
    while (d.firstChild) document.body.appendChild(d.firstChild);
    document.getElementById('menuBtn').addEventListener('click', function () { document.body.classList.add('menu-open'); });
    document.querySelector('.backdrop').addEventListener('click', closeMenu);
    document.querySelector('.drawer-close').addEventListener('click', closeMenu);
    document.querySelectorAll('.mitem').forEach(function (b) {
      b.addEventListener('click', function () { goSection(b.getAttribute('data-go')); });
    });
  })();

  document.title = SHOP.name;
  document.getElementById('shopName').textContent = SHOP.name;
  document.getElementById('footer').innerHTML = '<div class="in"><strong>' + esc(SHOP.name) + '</strong>' +
    '<div class="faddr">' + esc(SHOP.address) + (SHOP.hours ? ' · ' + esc(SHOP.hours) : '') + '</div>' +
    '<div class="flinks"><a href="#/gallery">جولة داخل المحل</a><a class="q-map"' + ext(SHOP.mapLink) + '>' + ic('pin') + ' الخريطة</a>' +
    '<a class="q-fb"' + ext(SHOP.facebook) + '>' + ic('fb') + ' فيسبوك</a>' +
    SHOP.whatsapp.map(function (n) { return '<a class="q-wa"' + ext('https://wa.me/' + n) + '>' + ic('wa') + ' <bdi dir="ltr">0' + esc(n.slice(2)) + '</bdi></a>'; }).join('') +
    '</div></div>';
  function start() {
    setCart(getCart());
    window.addEventListener('hashchange', route);
    route();
  }
  if (db) {
    app.innerHTML = '<div class="empty">جارى تحميل القطع...</div>';
    db.from('parts').select('*').order('id', { ascending: false }).then(function (res) {
      if (res.error) {
        app.innerHTML = '<div class="empty">تعذر تحميل القطع، جرب تحديث الصفحة</div>';
        return;
      }
      PARTS = res.data.map(function (r) {
        return {
          id: 'P' + r.id, dbId: r.id, name: r.name, brand: r.brand, model: r.model,
          yearFrom: r.year_from || r.year_to || null, yearTo: r.year_to || r.year_from || null, category: r.category, condition: r.condition,
          price: Number(r.price), sold: r.sold, desc: r.description, images: r.images || [],
        };
      });
      document.querySelector('.demo-note').style.display = 'none';
      // صور «جولة داخل المحل» من لوحة الإدارة؛ لو الجدول لسه مش موجود تفضل الصور اللى فى config.js
      return db.from('tour_photos').select('url').order('id').then(function (t) {
        if (!t.error) SHOP.gallery = t.data.map(function (x) { return x.url; });
        start();
      });
    });
  } else start();
})();
