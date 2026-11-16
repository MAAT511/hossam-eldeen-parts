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
      (SHOP.gallery && SHOP.gallery.length ? '<section class="strip">' + SHOP.gallery.map(function (s) {
        return '<a href="' + esc(s) + '" target="_blank" rel="noopener"><img loading="lazy" src="' + esc(s) + '" alt="صورة من المحل"></a>';
      }).join('') + '</section>' : '') +
      '<section class="filters">' +
      '<input class="wide" id="f-q" type="search" placeholder="ابحث باسم القطعة أو الموديل" value="' + esc(filters.q) + '">' +
      '<select id="f-brand">' + options(uniq(PARTS.map(function (p) { return p.brand; })), filters.brand, 'كل الماركات') + '</select>' +
      '<select id="f-model">' + options(uniq(models), filters.model, 'كل الموديلات') + '</select>' +
      '<select id="f-year">' + options(uniq(years).reverse(), filters.year, 'سنة الصنع') + '</select>' +
      '<select id="f-category">' + options(uniq(PARTS.map(function (p) { return p.category; })), filters.category, 'نوع القطعة') + '</select>' +
      '<select id="f-condition">' + options(uniq(PARTS.map(function (p) { return p.condition; })), filters.condition, 'الحالة') + '</select>' +
      '<label class="check wide"><input id="f-hideSold" type="checkbox"' + (filters.hideSold ? ' checked' : '') + '> إخفاء القطع المباعة</label>' +
      '</section><div class="count" id="count"></div><div id="list"></div>' +
      '<section class="panel fb"><h2>آخر منشورات المحل على فيسبوك</h2>' +
      '<iframe title="صفحة المحل على فيسبوك" loading="lazy" scrolling="no" frameborder="0" allow="encrypted-media; picture-in-picture; web-share" src="https://www.facebook.com/plugins/page.php?href=' +
      encodeURIComponent(SHOP.facebook) + '&tabs=timeline&width=500&height=700&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false"></iframe>' +
      '<a class="btn ghost block" target="_blank" rel="noopener" href="' + esc(SHOP.facebook) + '">افتح الصفحة على فيسبوك</a></section>';
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

  // ---------- التنقل ----------
  function route() {
    var h = location.hash.replace(/^#\/?/, '');
    window.scrollTo(0, 0);
    if (h.indexOf('part/') === 0) viewPart(decodeURIComponent(h.slice(5)));
    else if (h === 'cart') viewCart();
    else if (h === 'checkout') viewCheckout();
    else viewHome();
  }

  document.title = SHOP.name;
  document.getElementById('shopName').textContent = SHOP.name;
  document.getElementById('footer').innerHTML = '<div class="in"><strong>' + esc(SHOP.name) + '</strong>' +
    '<div>📍 ' + esc(SHOP.address) + ' — <a target="_blank" rel="noopener" href="' + esc(SHOP.mapLink) + '">الموقع على الخريطة</a></div>' +
    SHOP.phones.map(function (p) { return '<div>📞 ' + esc(p.label) + ': <a href="tel:' + esc(p.number) + '">' + esc(p.number) + '</a></div>'; }).join('') +
    (SHOP.hours ? '<div>🕙 ' + esc(SHOP.hours) + '</div>' : '') +
    '<div><a target="_blank" rel="noopener" href="' + esc(SHOP.facebook) + '">صفحتنا على فيسبوك</a>' + SHOP.whatsapp.map(function (n) {
      return ' · <a target="_blank" rel="noopener" href="https://wa.me/' + esc(n) + '">واتساب <bdi dir="ltr">0' + esc(n.slice(2)) + '</bdi></a>';
    }).join('') + '</div></div>';
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
      start();
    });
  } else start();
})();
