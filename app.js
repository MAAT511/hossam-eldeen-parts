(function () {
  'use strict';
  var SHOP = window.SHOP, PARTS = window.PARTS;
  var app = document.getElementById('app');
  var CART_KEY = 'parts_cart_v1', QCART_KEY = 'inq_cart_v1';
  // لو قاعدة البيانات مربوطة فى config.js القطع تتقرأ منها، وإلا تظهر القطع التجريبية
  var db = (SHOP.supabaseUrl && SHOP.supabaseKey && window.supabase) ? window.supabase.createClient(SHOP.supabaseUrl, SHOP.supabaseKey) : null;
  var filters = { q: '', brand: '', model: '', year: '', category: '', condition: '', hideSold: false };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return Number(n).toLocaleString('en-US') + ' ج.م'; }

  // ---------- إيصال التحويل ----------
  function needsReceipt(pay) { return pay === 'transfer_pickup' || pay === 'transfer_ship'; }
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 1280, k = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('تعذر تجهيز الصورة')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('الملف ده مش صورة')); };
      img.src = url;
    });
  }
  // الصورة تترفع باسم عشوائى وتتربط بالطلب برمزه السرى المحفوظ على الموبايل
  function sendReceipt(token, file) {
    return shrink(file).then(function (blob) {
      var path = Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.jpg';
      return db.storage.from('receipts').upload(path, blob, { contentType: 'image/jpeg' }).then(function (up) {
        if (up.error) throw up.error;
        var url = db.storage.from('receipts').getPublicUrl(path).data.publicUrl;
        return db.rpc('attach_receipt', { p_token: token, p_url: url }).then(function (res) {
          if (res.error) throw res.error;
          return url;
        });
      });
    });
  }
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
  // المحل مفتوح دلوقتى ولا لأ (بتوقيت القاهرة)
  function openStatus() {
    if (!SHOP.openDays || !SHOP.openDays.length || SHOP.openFrom == null || SHOP.openTo == null) return null;
    try {
      var now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
      var h = now.getHours() + now.getMinutes() / 60;
      return { open: SHOP.openDays.indexOf(now.getDay()) >= 0 && h >= SHOP.openFrom && h < SHOP.openTo };
    } catch (e) { return null; }
  }
  // الكفر: اللوجو واسم المحل والوصف ومواعيد العمل
  function heroHtml() {
    var st = openStatus();
    return '<section class="hero' + (SHOP.cover ? ' has-cover" style="background-image:linear-gradient(to top, rgba(12,18,26,.95) 0%, rgba(12,18,26,.6) 42%, rgba(12,18,26,.1) 100%), url(\'' + esc(encodeURI(SHOP.cover)) + '\')' : '') + '">' +
      '<div class="hero-in"><img class="hero-logo" src="images/logo.jpg" alt=""><div class="hero-text">' +
      '<h1>' + esc(SHOP.name) + '</h1><p>' + esc(SHOP.tagline) + '</p>' +
      '<div class="chips">' +
      (st ? '<span class="chip ' + (st.open ? 'chip-open' : 'chip-closed') + '">' + (st.open ? 'مفتوح الآن' : 'مغلق الآن') + '</span>' : '') +
      (SHOP.hours ? '<span class="chip">' + ic('clock') + ' ' + esc(SHOP.hours) + '</span>' : '') +
      '</div></div></div></section>';
  }
  // أزرار الوصول السريع تحت الكفر
  function quickHtml() {
    return '<nav class="quick" id="sec-contact">' +
      '<a class="q q-map"' + ext(SHOP.mapLink) + '><span class="qi">' + ic('pin') + '</span><span><strong>موقع المحل</strong><small>افتح الخريطة</small></span></a>' +
      '<a class="q q-fb"' + ext(SHOP.facebook) + '><span class="qi">' + ic('fb') + '</span><span><strong>صفحة فيسبوك</strong><small>تابع الجديد</small></span></a>' +
      '<a class="q q-wa"' + ext('https://wa.me/' + SHOP.whatsapp[0]) + '><span class="qi">' + ic('wa') + '</span><span><strong>واتساب</strong><small>راسلنا الآن</small></span></a>' +
      '<a class="q q-call" href="tel:' + esc(SHOP.phones[0].number) + '"><span class="qi">' + ic('phone') + '</span><span><strong>اتصل بنا</strong><small><bdi dir="ltr">' + esc(SHOP.phones[0].number) + '</bdi></small></span></a>' +
      '</nav>';
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
    return ids.filter(function (id) { return !!cartItem(id); });
  }
  // عنصر السلة: قطعة بسعرها المعروض، أو استعلام بسعر متفق عليه مع المحل (مفتاحه يبدأ بـ Q:)
  function cartItem(key) {
    if (String(key).indexOf('Q:') === 0) {
      var q = lsGet(QCART_KEY, {})[key.slice(2)];
      return q ? { key: key, name: q.name, sub: 'سعر متفق عليه مع المحل', price: Number(q.price), token: key.slice(2) } : null;
    }
    var p = byId(key);
    return p && !p.sold ? { key: key, name: p.name, sub: p.brand + ' ' + p.model + ' · ' + p.id, price: p.price, dbId: p.dbId } : null;
  }
  function cartItems() { return getCart().map(cartItem); }
  function setCart(ids) {
    try { localStorage.setItem(CART_KEY, JSON.stringify(ids)); } catch (e) { /* تجاهل */ }
    document.getElementById('cartCount').textContent = ids.length;
  }
  function addToCart(id) { var c = getCart(); if (c.indexOf(id) < 0) c.push(id); setCart(c); }
  function removeFromCart(id) { setCart(getCart().filter(function (x) { return x !== id; })); }
  function cartTotal() { return cartItems().reduce(function (s, it) { return s + it.price; }, 0); }

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
    clearRails();
    var years = [];
    PARTS.forEach(function (p) { if (p.yearFrom) for (var y = p.yearFrom; y <= p.yearTo; y++) years.push(y); });
    var models = PARTS.filter(function (p) { return !filters.brand || p.brand === filters.brand; }).map(function (p) { return p.model; });
    app.innerHTML =
      heroHtml() +
      quickHtml() + '<div class="sec-head" id="sec-search"><h2>البحث</h2></div>' +
      '<section class="filters">' +
      '<input class="wide" id="f-q" type="search" placeholder="ابحث باسم القطعة أو الموديل" value="' + esc(filters.q) + '">' +
      '<details class="wide"' + (filters.brand || filters.model || filters.year || filters.category || filters.condition || filters.hideSold ? ' open' : '') + '><summary>فلترة بالماركة والموديل والسنة</summary><div class="fgrid">' +
      '<select id="f-brand">' + options(uniq(PARTS.map(function (p) { return p.brand; })), filters.brand, 'كل الماركات') + '</select>' +
      '<select id="f-model">' + options(uniq(models), filters.model, 'كل الموديلات') + '</select>' +
      '<select id="f-year">' + options(uniq(years).reverse(), filters.year, 'سنة الصنع') + '</select>' +
      '<select id="f-category">' + options(uniq(PARTS.map(function (p) { return p.category; })), filters.category, 'نوع القطعة') + '</select>' +
      '<select id="f-condition">' + options(uniq(PARTS.map(function (p) { return p.condition; })), filters.condition, 'الحالة') + '</select>' +
      '<label class="check wide"><input id="f-hideSold" type="checkbox"' + (filters.hideSold ? ' checked' : '') + '> إخفاء القطع المباعة</label>' +
      '</div></details></section><div class="sec-head offers" id="sec-offers"><h2>عروض حسام الدين</h2></div><div class="count" id="count"></div><div id="list"></div>' +
      (SHOP.gallery && SHOP.gallery.length ? '<section class="tour" id="sec-tour"><div class="sec-head"><h2>جولة داخل المحل</h2><a href="#/gallery">عرض كل الصور ←</a></div>' +
        '<div class="strip">' + SHOP.gallery.map(function (s) {
          return '<a href="#/gallery"><img loading="lazy" src="' + esc(s) + '" alt="صورة من المحل"></a>';
        }).join('') + '</div></section>' : '');
    renderList();
    document.getElementById('f-q').addEventListener('input', function (e) { filters.q = e.target.value; renderList(); });
    ['brand', 'model', 'year', 'category', 'condition'].forEach(function (k) {
      document.getElementById('f-' + k).addEventListener('change', function (e) {
        filters[k] = e.target.value;
        if (k === 'brand') { filters.model = ''; viewHome(); } else renderList();
      });
    });
    document.getElementById('f-hideSold').addEventListener('change', function (e) { filters.hideSold = e.target.checked; renderList(); });
    syncRails();
  }

  // ---------- صفحة القطعة ----------
  function viewPart(id) {
    var p = byId(id);
    if (!p) { app.innerHTML = '<div class="empty">القطعة غير موجودة</div>'; return; }
    var inCart = getCart().indexOf(p.id) >= 0;
    var nego = 'السلام عليكم، عاوز أتفاوض على سعر القطعة دى:\n' + p.name + ' — ' + p.brand + ' ' + p.model +
      (p.yearFrom ? ' (' + p.yearFrom + ' إلى ' + p.yearTo + ')' : '') + '\nكود القطعة: ' + p.id + '\nالسعر المعروض: ' + money(p.price);
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
      (db && p.dbId ? '<button class="btn ghost block" id="inq">استعلم عن القطعة</button>' : '') +
      (p.sold ? '' : waButtons(nego, 'تفاوض على السعر واتساب')) +
      '</div></div></div>';
    var add = document.getElementById('add');
    if (add) add.addEventListener('click', function () { addToCart(p.id); viewPart(p.id); });
    var inq = document.getElementById('inq');
    if (inq) inq.addEventListener('click', function () {
      openInquiry({ partDbId: p.dbId, photo: p.images && p.images[0], title: p.name + ' — ' + p.brand + ' ' + p.model });
    });
  }

  // ---------- السلة ----------
  function cartRows(withRemove) {
    return cartItems().map(function (it) {
      return '<div class="row"><div><strong>' + esc(it.name) + '</strong><div class="meta">' + esc(it.sub) + '</div></div>' +
        '<div style="text-align:left"><div class="price">' + money(it.price) + '</div>' +
        (withRemove ? '<button class="btn ghost small" data-remove="' + esc(it.key) + '">حذف</button>' : '') + '</div></div>';
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
    shop_cash: 'الدفع عند الاستلام من المحل',
    transfer_pickup: 'تحويل فودافون كاش أو إنستاباى، ثم الاستلام من المحل',
    transfer_ship: 'تحويل فودافون كاش أو إنستاباى، ثم الشحن',
  };
  function isShip(pay) { return pay === 'transfer_ship'; }
  function transferNote() {
    return SHOP.transferNumber
      ? 'حوّل على رقم <bdi dir="ltr">' + esc(SHOP.transferNumber) + '</bdi> وابعت صورة الإيصال على الواتساب'
      : 'المحل هيبعت لك رقم التحويل على الواتساب بعد تأكيد الطلب';
  }
  // تحديث أسعار الاستعلامات اللى فى السلة من السيرفر (المحل ممكن يكون عدّل السعر بعد التفاوض)
  function syncInquiryPrices(list) {
    var map = lsGet(QCART_KEY, {});
    list.forEach(function (i) {
      if (!map[i.token]) return;
      if (i.price == null || i.ordered) delete map[i.token]; else map[i.token].price = Number(i.price);
    });
    lsSet(QCART_KEY, map);
  }
  function viewCheckout() {
    var tokens = cartItems().filter(function (it) { return it.token; }).map(function (it) { return it.token; });
    if (db && tokens.length && !viewCheckout.synced) {
      app.innerHTML = '<div class="empty">جارى التحميل...</div>';
      db.rpc('my_inquiries', { p_tokens: tokens }).then(function (res) {
        if (!res.error) syncInquiryPrices(res.data);
        viewCheckout.synced = true; viewCheckout(); viewCheckout.synced = false;
        setCart(getCart());
      });
      return;
    }
    if (!getCart().length) { location.hash = '#/cart'; return; }
    app.innerHTML = '<a class="back" href="#/cart">→ رجوع للسلة</a><h2>إتمام الطلب</h2>' +
      '<div class="panel">' + cartRows(false) + '<div class="row total"><span>الإجمالى</span><span>' + money(cartTotal()) + '</span></div></div>' +
      '<form class="panel" id="order" novalidate>' +
      '<label class="field"><span>الاسم (اختيارى)</span><input name="name" autocomplete="name"></label>' +
      '<label class="field"><span>رقم الموبايل</span><input name="phone" type="tel" inputmode="numeric" placeholder="01xxxxxxxxx"></label>' +
      '<h3>طريقة الدفع والاستلام</h3><div class="pay">' +
      '<label><input type="radio" name="pay" value="shop_cash" checked><span>' + PAY.shop_cash + '</span></label>' +
      '<label><input type="radio" name="pay" value="transfer_pickup"><span>' + PAY.transfer_pickup +
      '<br><span class="meta">' + transferNote() + '</span></span></label>' +
      '<label><input type="radio" name="pay" value="transfer_ship"><span>' + PAY.transfer_ship +
      '<br><span class="meta">' + transferNote() + '</span>' +
      '<br><span class="meta">تكلفة الشحن على العميل، ويتفق عليها مباشرة مع شركة الشحن</span></span></label>' +
      '</div>' +
      '<div id="ship-fields" hidden>' +
      '<label class="field"><span>المحافظة</span><input name="city"></label>' +
      '<label class="field"><span>العنوان بالتفصيل</span><textarea name="address" rows="2"></textarea></label></div>' +
      '<div id="receipt-field" hidden><h3>صورة إيصال التحويل</h3>' +
      '<label class="btn ghost block"><span id="receipt-name">اختر صورة الإيصال</span>' +
      '<input name="receipt" type="file" accept="image/*" hidden></label>' +
      '<p class="meta" style="margin-top:8px">لو لسه ما حوّلتش، كمّل الطلب دلوقتى وارفع الإيصال بعدين من صفحة طلباتى</p></div>' +
      '<label class="field"><span>ملاحظات (اختيارى)</span><textarea name="notes" rows="2"></textarea></label>' +
      '<div class="err" id="err"></div>' +
      '<button class="btn block" type="submit">تأكيد الطلب</button></form>';
    var form = document.getElementById('order');
    // خانات العنوان تظهر فى حالة الشحن بس، وخانة الإيصال مع التحويل بس
    function syncPay() {
      document.getElementById('ship-fields').hidden = !isShip(form.pay.value);
      document.getElementById('receipt-field').hidden = !needsReceipt(form.pay.value);
    }
    form.querySelectorAll('[name=pay]').forEach(function (r) { r.addEventListener('change', syncPay); });
    syncPay();
    form.receipt.addEventListener('change', function () {
      var f = this.files[0];
      document.getElementById('receipt-name').textContent = f ? 'الصورة المختارة: ' + f.name.slice(-28) : 'اختر صورة الإيصال';
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, err = document.getElementById('err');
      var d = { name: f.name.value.trim(), phone: f.phone.value.trim(), city: f.city.value.trim(), address: f.address.value.trim(), notes: f.notes.value.trim(), pay: f.pay.value };
      if (!/^01[0125]\d{8}$/.test(d.phone)) { err.textContent = 'رقم الموبايل لازم يكون 11 رقم ويبدأ بـ 01'; return; }
      if (isShip(d.pay) && (!d.city || !d.address)) { err.textContent = 'اكتب المحافظة والعنوان بالتفصيل للشحن'; return; }
      if (!db) { viewDone(d, { id: 'T' + Date.now().toString().slice(-7) }); return; }
      var btn = f.querySelector('button[type=submit]');
      btn.disabled = true; err.textContent = 'جارى تسجيل الطلب...';
      var items = cartItems();
      var args = {
        p_name: d.name, p_phone: d.phone, p_city: d.city, p_address: d.address, p_notes: d.notes, p_pay: d.pay,
        p_part_ids: items.filter(function (it) { return !it.token; }).map(function (it) { return it.dbId; }),
      };
      var tokens = items.filter(function (it) { return it.token; }).map(function (it) { return it.token; });
      if (tokens.length) args.p_inquiry_tokens = tokens;
      db.rpc('place_order', args).then(function (res) {
        if (res.error) { btn.disabled = false; err.textContent = 'تعذر تسجيل الطلب: ' + res.error.message; return; }
        // الرمز السرى يتحفظ على الموبايل عشان العميل يتابع طلبه من «طلباتى»
        lsSet(ORDERS_KEY, lsGet(ORDERS_KEY, []).concat([res.data.token]).slice(-50));
        var file = f.receipt && !document.getElementById('receipt-field').hidden ? f.receipt.files[0] : null;
        if (!file) { viewDone(d, res.data); return; }
        err.textContent = 'جارى رفع الإيصال...';
        sendReceipt(res.data.token, file).then(function (url) {
          res.data.receipt_url = url;
          viewDone(d, res.data);
        })['catch'](function () {
          viewDone(d, res.data, 'الطلب اتسجل، بس صورة الإيصال ما اترفعتش. ارفعها من صفحة طلباتى.');
        });
      });
    });
  }
  function viewDone(d, order, warn) {
    var no = order.id;
    var lines = cartItems().map(function (it) { return '- ' + it.name + ' (' + it.sub + ') — ' + money(it.price); });
    var msg = 'طلب جديد رقم ' + no + '\n' + lines.join('\n') + '\nالإجمالى: ' + money(cartTotal()) +
      '\n' + (d.name ? '\nالاسم: ' + d.name : '') + '\nالموبايل: ' + d.phone +
      (isShip(d.pay) ? '\nالمحافظة: ' + d.city + '\nالعنوان: ' + d.address : '') +
      '\nطريقة الدفع: ' + PAY[d.pay] + (d.notes ? '\nملاحظات: ' + d.notes : '') +
      (order.receipt_url ? '\n\nصورة إيصال التحويل:\n' + order.receipt_url : '');
    var total = money(cartTotal());
    setCart([]);
    app.innerHTML = '<div class="panel" style="text-align:center"><div style="font-size:48px">✅</div>' +
      '<h2>طلبك اتسجل</h2><p>رقم الطلب: <strong>' + esc(no) + '</strong> — الإجمالى: <strong>' + total + '</strong></p>' +
      (warn ? '<p class="err">' + esc(warn) + '</p>' : '') +
      (order.receipt_url ? '<p class="meta">صورة الإيصال اتحفظت مع الطلب، والمحل هيشوفها عنده.</p>' : '') +
      '<p class="meta">ابعت الطلب للمحل على الواتساب عشان يأكده معاك' +
      (d.pay === 'shop_cash' ? '' : ' ويستلم التحويل') + '.</p>' +
      '<p class="meta">بعد ما المحل يأكد الطلب هيظهر لك كود الاستلام فى صفحة «طلباتى».</p>' +
      '<div class="stack">' + waButtons(msg, 'إرسال الطلب على واتساب') +
      '<a class="btn ghost block" href="#/orders">طلباتى</a>' +
      '<a class="btn ghost block" href="#/">رجوع للقطع</a></div></div>';
  }

  // ---------- معرض المحل ----------
  function viewGallery() {
    // الكفر بيتزود فى أول المعرض، إلا لو هو أصلا واحدة من صور الجولة
    var gal = SHOP.gallery || [];
    var pics = (SHOP.cover && gal.indexOf(SHOP.cover) < 0 ? [SHOP.cover] : []).concat(gal);
    app.innerHTML = '<a class="back" href="#/">→ رجوع للرئيسية</a>' +
      '<div class="sec-head"><h2>جولة داخل المحل</h2></div>' +
      '<p class="meta" style="margin-top:-4px">صور من داخل ' + esc(SHOP.name) + ' — اضغط على أى صورة لتكبيرها</p>' +
      '<div class="gal">' + pics.map(function (s, i) {
        return '<div class="gitem"><button type="button" class="gpic" data-i="' + i + '"><img loading="lazy" src="' + esc(s) + '" alt="صورة من المحل"></button>' +
          (db ? '<button type="button" class="btn small block ginq" data-i="' + i + '">استعلم عن السعر</button>' : '') + '</div>';
      }).join('') + '</div>' +
      '<div class="cta" style="margin-top:16px"><a class="btn" href="#/">تصفح القطع المعروضة</a></div>';
    app.querySelectorAll('.ginq').forEach(function (b) {
      b.addEventListener('click', function () { openInquiry({ photo: pics[Number(b.getAttribute('data-i'))], title: 'صورة من جولة داخل المحل' }); });
    });
    app.querySelectorAll('.gal .gpic').forEach(function (b) {
      b.addEventListener('click', function () {
        var box = document.createElement('div');
        box.className = 'lightbox';
        box.innerHTML = '<img src="' + esc(pics[Number(b.getAttribute('data-i'))]) + '" alt="صورة من المحل"><span>إغلاق ✕</span>';
        box.addEventListener('click', function () { box.remove(); });
        document.body.appendChild(box);
      });
    });
  }

  // ---------- الاستعلامات ----------
  var INQ_KEY = 'my_inquiries_v1', SEEN_KEY = 'inq_seen_v1', WHO_KEY = 'inq_who_v1';
  var ORDERS_KEY = 'my_orders_v1', OSEEN_KEY = 'orders_seen_v1';
  function lsGet(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* تجاهل */ } }
  // الأرقام الحمرا: ردود الاستعلامات الجديدة وتغيّر حالة الطلبات
  var badges = { inq: 0, ord: 0 };
  function setBadge(kind, n) {
    badges[kind] = n || 0;
    document.querySelectorAll('.reply-badge').forEach(function (b) {
      var k = b.getAttribute('data-badge');
      var v = k ? badges[k] : badges.inq + badges.ord;
      b.textContent = v || '';
      b.style.display = v ? '' : 'none';
    });
  }
  function checkReplies() {
    if (!db) return;
    var inq = lsGet(INQ_KEY, []);
    if (inq.length) db.rpc('my_inquiries', { p_tokens: inq }).then(function (res) {
      if (res.error) return;
      var seen = lsGet(SEEN_KEY, []);
      setBadge('inq', res.data.filter(function (i) { return i.answer && seen.indexOf(i.token) < 0; }).length);
    });
    var ord = lsGet(ORDERS_KEY, []);
    if (ord.length) db.rpc('my_orders', { p_tokens: ord }).then(function (res) {
      if (res.error) return;
      var seen = lsGet(OSEEN_KEY, []);
      setBadge('ord', res.data.filter(function (o) { return o.status !== 'new' && seen.indexOf(o.token + ':' + o.status) < 0; }).length);
    });
  }

  // ---------- طلباتى ----------
  function orderStatusText(o) {
    if (o.status === 'new') return 'فى انتظار تأكيد المحل';
    if (o.status === 'cancelled') return 'ملغى';
    if (o.status === 'ready') return isShip(o.pay_method) ? 'جاهز للشحن' : 'لم يتم الاستلام';
    return isShip(o.pay_method) ? 'تم الشحن' : 'تم الاستلام';
  }
  function viewOrders() {
    var tokens = lsGet(ORDERS_KEY, []);
    var head = '<a class="back" href="#/">→ رجوع للرئيسية</a><div class="sec-head"><h2>طلباتى</h2></div>';
    if (!db || !tokens.length) {
      app.innerHTML = head + '<div class="empty">لسه ما عملتش أى طلب من الموبايل ده<br><br><a class="btn" href="#/">تصفح القطع</a></div>';
      return;
    }
    app.innerHTML = head + '<div class="empty">جارى التحميل...</div>';
    db.rpc('my_orders', { p_tokens: tokens }).then(function (res) {
      if (location.hash.replace(/^#\/?/, '') !== 'orders') return;
      if (res.error) { app.innerHTML = head + '<div class="empty">تعذر تحميل الطلبات، جرب تحديث الصفحة</div>'; return; }
      lsSet(OSEEN_KEY, res.data.map(function (o) { return o.token + ':' + o.status; }));
      setBadge('ord', 0);
      app.innerHTML = head + '<p class="meta" style="margin-top:-4px">الطلبات دى محفوظة على الموبايل والمتصفح ده فقط</p>' +
        (res.data.length ? res.data.map(function (o) {
          var cls = o.status === 'done' ? '' : o.status === 'cancelled' ? ' sold' : ' wait';
          return '<div class="panel"><div class="row"><strong>طلب رقم ' + esc(o.id) + '</strong>' +
            '<span class="meta">' + new Date(o.created_at).toLocaleDateString('ar-EG') + '</span></div>' +
            '<ul class="olist">' + (o.items || []).map(function (it) {
              return '<li>' + esc(it.name) + (it.brand || it.model ? ' (' + esc(it.brand) + ' ' + esc(it.model) + ')' : '') + ' — ' + money(it.price) + '</li>';
            }).join('') + '</ul>' +
            '<div class="row total"><span>الإجمالى</span><span>' + money(o.total) + '</span></div>' +
            '<div class="meta">' + esc(PAY[o.pay_method] || o.pay_method) + '</div>' +
            (isShip(o.pay_method) ? '<div class="meta">تكلفة الشحن على العميل ويتفق عليها مع شركة الشحن</div>' : '') +
            '<div style="margin-top:8px"><span class="tag' + cls + '">' + orderStatusText(o) + '</span></div>' +
            (o.pickup_code ? '<div class="code-box"><span>' + (isShip(o.pay_method) ? 'كود الطلب' : 'كود الاستلام — ورّيه للمحل') + '</span>' +
              '<strong>' + esc(o.pickup_code) + '</strong></div>' : '') +
            receiptBox(o) +
            '</div>';
        }).join('') : '<div class="empty">لا توجد طلبات</div>');
      wireReceipts();
    });
  }
  // زرار رفع الإيصال يبان فى طلبات التحويل اللى لسه ما اتقفلتش
  function receiptBox(o) {
    if (!needsReceipt(o.pay_method)) return '';
    var open = o.status === 'new' || o.status === 'ready';
    var seen = o.receipt_url
      ? '<div class="meta" style="margin-top:8px">صورة الإيصال اتبعتت للمحل · ' +
        '<a target="_blank" rel="noopener" href="' + esc(o.receipt_url) + '">افتح الصورة</a></div>' : '';
    if (!open) return seen;
    return seen + '<label class="btn block' + (o.receipt_url ? ' ghost' : '') + '" style="margin-top:8px">' +
      '<span>' + (o.receipt_url ? 'تغيير صورة الإيصال' : 'ارفع صورة إيصال التحويل') + '</span>' +
      '<input type="file" accept="image/*" hidden data-up="' + esc(o.token) + '"></label>';
  }
  function wireReceipts() {
    app.querySelectorAll('[data-up]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var file = this.files[0];
        if (!file) return;
        var txt = this.parentNode.querySelector('span'), old = txt.textContent;
        txt.textContent = 'جارى رفع الإيصال...';
        this.disabled = true;
        sendReceipt(this.getAttribute('data-up'), file).then(function () { viewOrders(); })['catch'](function (e) {
          txt.textContent = old;
          alert('تعذر رفع الإيصال: ' + ((e && e.message) || e));
        });
      });
    });
  }
  function openInquiry(opt) {
    var who = lsGet(WHO_KEY, {});
    var box = document.createElement('div');
    box.className = 'modal';
    box.innerHTML = '<form class="panel modal-card" novalidate><h2>استعلام عن السعر</h2>' +
      (opt.photo ? '<img class="modal-pic" src="' + esc(opt.photo) + '" alt="">' : '') +
      '<div class="meta" style="margin-bottom:8px">' + esc(opt.title || '') + '</div>' +
      '<label class="field"><span>رقم الواتساب</span><input name="phone" type="tel" inputmode="numeric" placeholder="01xxxxxxxxx" value="' + esc(who.phone || '') + '"></label>' +
      '<label class="field"><span>' + (opt.partDbId ? 'سؤالك عن القطعة' : 'القطعة اللى بتسأل عنها فى الصورة') + '</span><textarea name="question" rows="3"></textarea></label>' +
      '<div class="err"></div><div class="two"><button class="btn" type="submit">إرسال الاستعلام</button>' +
      '<button class="btn ghost" type="button" data-close>إلغاء</button></div></form>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) { if (e.target === box || e.target.hasAttribute('data-close')) box.remove(); });
    box.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, err = f.querySelector('.err'), btn = f.querySelector('button[type=submit]');
      var d = { phone: f.phone.value.trim(), question: f.question.value.trim() };
      if (!/^01[0125]\d{8}$/.test(d.phone)) { err.textContent = 'رقم الواتساب لازم يكون 11 رقم ويبدأ بـ 01'; return; }
      if (!opt.partDbId && d.question.length < 2) { err.textContent = 'اكتب القطعة اللى بتسأل عنها'; return; }
      btn.disabled = true; err.textContent = 'جارى الإرسال...';
      db.rpc('submit_inquiry', {
        p_name: 'عميل', p_phone: d.phone, p_question: d.question,
        p_photo_url: opt.partDbId ? '' : (opt.photo || ''), p_part_id: opt.partDbId || null,
      }).then(function (res) {
        if (res.error) { btn.disabled = false; err.textContent = 'تعذر إرسال الاستعلام: ' + res.error.message; return; }
        lsSet(INQ_KEY, lsGet(INQ_KEY, []).concat([res.data]).slice(-50));
        lsSet(WHO_KEY, { phone: d.phone });
        f.innerHTML = '<div style="text-align:center"><div style="font-size:44px">✅</div><h2>استعلامك وصل</h2>' +
          '<p class="meta">المحل هيرد عليك، وتقدر تشوف الرد من «استعلاماتى» فى القائمة على نفس الموبايل ده.</p>' +
          '<div class="stack"><a class="btn block" href="#/inquiries">استعلاماتى</a>' +
          '<button class="btn ghost block" type="button" data-close>إغلاق</button></div></div>';
      });
    });
  }
  function viewInquiries() {
    var tokens = lsGet(INQ_KEY, []);
    var head = '<a class="back" href="#/">→ رجوع للرئيسية</a><div class="sec-head"><h2>استعلاماتى</h2></div>';
    if (!db || !tokens.length) {
      app.innerHTML = head + '<div class="empty">لسه ما بعتش أى استعلام من الموبايل ده<br><br><a class="btn" href="#/gallery">جولة داخل المحل</a></div>';
      return;
    }
    app.innerHTML = head + '<div class="empty">جارى التحميل...</div>';
    db.rpc('my_inquiries', { p_tokens: tokens }).then(function (res) {
      if (location.hash.replace(/^#\/?/, '') !== 'inquiries') return;
      if (res.error) { app.innerHTML = head + '<div class="empty">تعذر تحميل الاستعلامات، جرب تحديث الصفحة</div>'; return; }
      lsSet(SEEN_KEY, res.data.filter(function (i) { return i.answer; }).map(function (i) { return i.token; }));
      setBadge('inq', 0);
      syncInquiryPrices(res.data);
      setCart(getCart());
      var inCart = getCart();
      app.innerHTML = head + '<p class="meta" style="margin-top:-4px">الاستعلامات دى محفوظة على الموبايل والمتصفح ده فقط</p>' +
        (res.data.length ? res.data.map(function (i) {
          var about = i.part_name || 'صورة من جولة داخل المحل';
          var nego = 'السلام عليكم، بخصوص استعلامى عن: ' + about + (i.question ? '\nسؤالى: ' + i.question : '') + '\nرد المحل: ' + i.answer + '\nعاوز أتفاوض على السعر.';
          return '<div class="panel"><div class="arow"><div class="thumb">' + (i.photo_url ? '<img src="' + esc(i.photo_url) + '" alt="">' : '🔩') + '</div>' +
            '<div class="grow"><strong>' + esc(about) + '</strong>' +
            (i.question ? '<div>' + esc(i.question) + '</div>' : '') +
            '<div class="meta">' + new Date(i.created_at).toLocaleDateString('ar-EG') + '</div></div></div>' +
            (i.answer ? '<div class="answer"><strong>رد المحل</strong><div>' + esc(i.answer) + '</div>' +
              (i.price != null ? '<div class="price" style="margin-top:6px">آخر سعر متفق عليه: ' + money(i.price) + '</div>' : '') + '</div>' +
              '<div class="stack">' + (i.ordered ? '<span class="tag">تم طلب القطعة دى</span>'
                : waButtons(nego, 'تفاوض على واتساب') +
                  (i.price != null && Number(i.price) > 0
                    ? (inCart.indexOf('Q:' + i.token) >= 0 ? '<a class="btn block" href="#/cart">القطعة فى السلة — اذهب للسلة</a>'
                      : '<button type="button" class="btn block" data-buy="' + esc(i.token) + '">إتمام الشراء بسعر ' + money(i.price) + ' 🛒</button>')
                    : '')) + '</div>'
              : '<span class="tag wait">فى انتظار رد المحل</span>') + '</div>';
        }).join('') : '<div class="empty">لا توجد استعلامات</div>');
      app.querySelectorAll('[data-buy]').forEach(function (b) {
        b.addEventListener('click', function () {
          var i = res.data.filter(function (x) { return x.token === b.getAttribute('data-buy'); })[0];
          var map = lsGet(QCART_KEY, {});
          map[i.token] = { name: (i.part_name || 'قطعة من صور المحل') + (i.question ? ' — ' + i.question : ''), price: Number(i.price) };
          lsSet(QCART_KEY, map);
          // لو نفس القطعة موجودة فى السلة بسعرها المعروض تتشال، ويفضل السعر المتفق عليه
          var cart = getCart().filter(function (k) { return k !== 'P' + i.part_id && k !== 'Q:' + i.token; });
          cart.push('Q:' + i.token);
          setCart(cart);
          location.hash = '#/cart';
        });
      });
    });
  }

  // ---------- الأعمدة الجانبية على الشاشات الكبيرة ----------
  var WIDE = window.matchMedia('(min-width: 1280px)');
  var shell = document.getElementById('shell');
  var railStart = document.getElementById('railStart');
  var railEnd = document.getElementById('railEnd');
  var railTimer = null;
  function clearRails() {
    if (railTimer) { clearInterval(railTimer); railTimer = null; }
    railStart.innerHTML = '';
    railEnd.innerHTML = '';
    shell.classList.remove('wide');
  }
  // صور أحدث العروض وصور الجولة بتتجمع مع بعض وتتبدل لوحدها
  function railPics() {
    var list = [];
    PARTS.filter(function (p) { return p.images && p.images.length; }).slice(0, 6).forEach(function (p) {
      list.push({ src: p.images[0], tag: 'عرض', title: p.name + (p.brand ? ' — ' + p.brand : ''), sub: money(p.price), href: '#/part/' + p.id });
    });
    (SHOP.gallery || []).slice(0, 6).forEach(function (s) {
      list.push({ src: s, tag: 'جولة', title: 'جولة داخل المحل', sub: 'اضغط لعرض كل الصور', href: '#/gallery' });
    });
    return list;
  }
  function buildRailEnd() {
    var pics = railPics();
    var offers = PARTS.filter(function (p) { return !p.sold; }).slice(0, 4);
    var tour = (SHOP.gallery || []).slice(0, 6);
    var st = openStatus();
    var html = '';
    if (pics.length) {
      html += '<div class="sec-head"><h2>شوف كمان</h2></div>' +
        '<a class="feat" href="#/"><span class="feat-pic"><img alt=""></span><span class="feat-body">' +
        '<span class="feat-tag"></span><strong class="feat-t"></strong><span class="feat-s"></span></span></a>' +
        '<div class="dots">' + pics.map(function (x, i) { return '<i data-i="' + i + '"></i>'; }).join('') + '</div>';
    }
    // كارت التواصل بيييجى بدرى عشان يفضل قدام الزبون من غير ما ينزل
    html += '<div class="rcard">' +
      (st ? '<span class="chip ' + (st.open ? 'chip-open' : 'chip-closed') + '">' + (st.open ? 'مفتوح الآن' : 'مغلق الآن') + '</span>' : '') +
      (SHOP.hours ? '<p class="meta">' + esc(SHOP.hours) + '</p>' : '') +
      '<a class="btn wa block"' + ext('https://wa.me/' + SHOP.whatsapp[0]) + '>' + ic('wa') + ' راسلنا على واتساب</a>' +
      '<a class="btn ghost block" href="tel:' + esc(SHOP.phones[0].number) + '">' + ic('phone') + ' <bdi dir="ltr">' + esc(SHOP.phones[0].number) + '</bdi></a>' +
      '</div>';
    if (offers.length) {
      html += '<div class="sec-head rsec"><h2>أحدث العروض</h2></div><div class="rlist">' +
        offers.map(function (p) {
          var sub = [p.brand, p.model].filter(Boolean).join(' ');
          return '<a class="ritem" href="#/part/' + esc(p.id) + '">' +
            '<span class="rthumb">' + (p.images && p.images[0] ? '<img loading="lazy" src="' + esc(p.images[0]) + '" alt="">' : '🔩') + '</span>' +
            '<span class="rtext"><strong>' + esc(p.name) + '</strong>' +
            (sub ? '<small>' + esc(sub) + '</small>' : '') +
            '<b>' + money(p.price) + '</b></span></a>';
        }).join('') + '</div>';
    }
    if (tour.length) {
      html += '<div class="sec-head rsec"><h2>جولة داخل المحل</h2><a href="#/gallery">الكل ←</a></div>' +
        '<div class="rgrid">' + tour.map(function (s) {
          return '<a href="#/gallery"><img loading="lazy" src="' + esc(s) + '" alt="صورة من داخل المحل"></a>';
        }).join('') + '</div>';
    }
    railEnd.innerHTML = html;
    if (!pics.length) return;
    var link = railEnd.querySelector('.feat'), img = railEnd.querySelector('.feat-pic img');
    var tag = railEnd.querySelector('.feat-tag'), ttl = railEnd.querySelector('.feat-t'), sub = railEnd.querySelector('.feat-s');
    var dots = railEnd.querySelectorAll('.dots i');
    var i = 0;
    function show(n) {
      i = (n + pics.length) % pics.length;
      var p = pics[i];
      img.style.opacity = '0';
      setTimeout(function () { img.src = p.src; img.style.opacity = '1'; }, 150);
      link.setAttribute('href', p.href);
      tag.textContent = p.tag;
      tag.className = 'feat-tag' + (p.tag === 'جولة' ? ' alt' : '');
      ttl.textContent = p.title;
      sub.textContent = p.sub;
      dots.forEach(function (d, k) { d.className = k === i ? 'on' : ''; });
    }
    function play() { if (railTimer) clearInterval(railTimer); railTimer = setInterval(function () { show(i + 1); }, 4500); }
    dots.forEach(function (d) { d.addEventListener('click', function () { show(Number(this.getAttribute('data-i'))); play(); }); });
    show(0);
    play();
  }
  // البحث والفلترة بينتقلوا للعمود اليمين، والصور تتبنى فى العمود الشمال
  function syncRails() {
    clearRails();
    if (!WIDE.matches) return;
    var head = document.getElementById('sec-search');
    var box = app.querySelector('.filters');
    if (!head || !box) return;
    shell.classList.add('wide');
    railStart.appendChild(head);
    railStart.appendChild(box);
    var det = box.querySelector('details');
    if (det) det.open = true;
    buildRailEnd();
  }
  // الصفحة تتبنى من أول وجديد بس لما نعدى حد الشاشة الكبيرة
  var wasWide = WIDE.matches, wideTimer = null;
  function onWide() {
    if (WIDE.matches === wasWide) return;
    wasWide = WIDE.matches;
    route();
  }
  if (WIDE.addEventListener) WIDE.addEventListener('change', onWide);
  else if (WIDE.addListener) WIDE.addListener(onWide);
  function watchWidth() {
    if (wideTimer) clearTimeout(wideTimer);
    wideTimer = setTimeout(onWide, 200);
  }
  window.addEventListener('resize', watchWidth);
  window.addEventListener('orientationchange', watchWidth);
  if (window.ResizeObserver) new ResizeObserver(watchWidth).observe(document.documentElement);

  // ---------- التنقل ----------
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    window.scrollTo(0, 0);
    clearRails();
    document.querySelectorAll('.modal, .lightbox').forEach(function (m) { m.remove(); });
    if (h === 'inquiries') { viewInquiries(); return; }
    if (h === 'orders') { viewOrders(); return; }
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
    { id: 'sec-search', label: 'البحث', icon: 'search' },
    { id: 'sec-offers', label: 'عروض حسام الدين', icon: 'tag' },
    { id: 'sec-tour', label: 'جولة داخل المحل', icon: 'photo' },
    { route: 'inquiries', label: 'استعلاماتى', icon: 'chat', badge: 'inq' },
    { route: 'orders', label: 'طلباتى', icon: 'bag', badge: 'ord' },
  ];
  ICONS.bag = 'M19 7h-3V6a4 4 0 0 0-8 0v1H5a1 1 0 0 0-1 1v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1zm-9-1a2 2 0 0 1 4 0v1h-4V6z';
  ICONS.chat ='M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z';
  ICONS.search = 'M15.500 14h-.800l-.300-.300A6.500 6.500 0 1 0 14 15.500l.300.300v.800l5 5 1.500-1.500-5.300-5.100zm-6 0a4.500 4.500 0 1 1 0-9 4.500 4.500 0 0 1 0 9z';
  ICONS.tag = 'M21.400 11.600l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7c0 .500.200 1 .600 1.400l9 9a2 2 0 0 0 2.800 0l7-7a2 2 0 0 0 0-2.800zM6.500 8A1.500 1.500 0 1 1 6.500 5a1.500 1.500 0 0 1 0 3z';
  ICONS.photo = 'M21 5H3a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1zM8 8.500a1.500 1.500 0 1 1 0 3 1.500 1.500 0 0 1 0-3zM4 17l4.500-4.500 2.500 2.500 4-5 5 7H4z';
  function closeMenu() { document.body.classList.remove('menu-open'); }
  function goSection(id) {
    closeMenu();
    var onHome = !location.hash.replace(/^#\/?/, '');
    if (onHome) {
      var el = document.getElementById(id);
      // لو القسم اتنقل للعمود الجانبى فهو ظاهر على طول، فنركز على خانة البحث بدل ما نلف الصفحة
      if (el && railStart.contains(el)) { var q = document.getElementById('f-q'); if (q) q.focus(); return; }
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else { pendingSection = id; location.hash = '#/'; }
  }
  (function buildMenu() {
    var d = document.createElement('div');
    d.innerHTML = '<div class="backdrop"></div><aside class="drawer" aria-label="القائمة">' +
      '<div class="drawer-head"><img class="logo-img" src="images/logo.jpg" alt=""><strong>' + esc(SHOP.shortName || SHOP.name) + '</strong><button type="button" class="drawer-close" aria-label="إغلاق القائمة">✕</button></div>' +
      MENU.map(function (m) {
        return '<button type="button" class="mitem" ' + (m.route ? 'data-route="' + m.route + '"' : 'data-go="' + m.id + '"') + '><span class="qi">' + ic(m.icon) + '</span>' + m.label +
          (m.badge ? '<span class="reply-badge" data-badge="' + m.badge + '" style="display:none"></span>' : '') + '</button>';
      }).join('') +
      '</aside>';
    while (d.firstChild) document.body.appendChild(d.firstChild);
    document.getElementById('menuBtn').insertAdjacentHTML('beforeend', '<span class="reply-badge" style="display:none"></span>');
    document.getElementById('menuBtn').addEventListener('click', function () { document.body.classList.add('menu-open'); });
    document.querySelector('.backdrop').addEventListener('click', closeMenu);
    document.querySelector('.drawer-close').addEventListener('click', closeMenu);
    document.querySelectorAll('.mitem').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.hasAttribute('data-route')) { closeMenu(); location.hash = '#/' + b.getAttribute('data-route'); }
        else goSection(b.getAttribute('data-go'));
      });
    });
  })();

  document.title = SHOP.name;
  document.getElementById('shopName').textContent = SHOP.shortName || SHOP.name;
  document.getElementById('footer').innerHTML = '<div class="in"><strong>' + esc(SHOP.name) + '</strong>' +
    '<div class="faddr">' + esc(SHOP.address) + (SHOP.hours ? ' · ' + esc(SHOP.hours) : '') + '</div>' +
    '<div class="flinks"><a href="#/gallery">جولة داخل المحل</a><a href="#/orders">طلباتى</a><a class="q-map"' + ext(SHOP.mapLink) + '>' + ic('pin') + ' الخريطة</a>' +
    '<a class="q-fb"' + ext(SHOP.facebook) + '>' + ic('fb') + ' فيسبوك</a>' +
    SHOP.whatsapp.map(function (n) { return '<a class="q-wa"' + ext('https://wa.me/' + n) + '>' + ic('wa') + ' <bdi dir="ltr">0' + esc(n.slice(2)) + '</bdi></a>'; }).join('') +
    '</div></div>';
  function start() {
    setCart(getCart());
    window.addEventListener('hashchange', route);
    route();
    checkReplies();
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
