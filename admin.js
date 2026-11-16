(function () {
  'use strict';
  var SHOP = window.SHOP, root = document.getElementById('admin');
  if (!SHOP.supabaseUrl || !SHOP.supabaseKey || !window.supabase) {
    root.innerHTML = '<div class="empty">لوحة الإدارة لسه مش مربوطة بقاعدة البيانات</div>';
    return;
  }
  var db = window.supabase.createClient(SHOP.supabaseUrl, SHOP.supabaseKey);
  var parts = [], orders = [], tab = 'parts', q = '';
  var CONDITIONS = ['ممتازة', 'جيدة جدا', 'جيدة'];
  var CATEGORIES = ['موتور وفتيس', 'كهرباء وإضاءة', 'صاج وهيكل', 'تكييف وتبريد', 'عفشة وفرامل', 'جنوط وكاوتش', 'صالون وفرش'];
  var BRANDS = ['فولكس فاجن', 'سكودا', 'أودى', 'سيات'];
  var STATUS = { new: 'جديد', confirmed: 'تم التأكيد', delivered: 'تم التسليم', cancelled: 'ملغى' };
  var PAY = { cod: 'الدفع عند الاستلام', transfer: 'تحويل إنستاباى', pickup: 'الاستلام والدفع فى المحل' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return Number(n).toLocaleString('en-US') + ' ج.م'; }
  function uniq(list) { return list.filter(function (v, i) { return v && list.indexOf(v) === i; }); }
  function datalist(id, list) { return '<datalist id="' + id + '">' + uniq(list).map(function (v) { return '<option value="' + esc(v) + '">'; }).join('') + '</datalist>'; }
  function fail(msg, error) { alert(msg + (error && error.message ? '\n' + error.message : '')); }

  // ---------- الدخول ----------
  function viewLogin(msg) {
    root.innerHTML = '<form class="panel" id="login" style="max-width:420px;margin:30px auto"><h2>دخول الأدمن</h2>' +
      '<label class="field"><span>الإيميل</span><input name="email" type="email" autocomplete="username" dir="ltr"></label>' +
      '<label class="field"><span>كلمة السر</span><input name="password" type="password" autocomplete="current-password" dir="ltr"></label>' +
      '<div class="err">' + esc(msg || '') + '</div><button class="btn block" type="submit">دخول</button></form>';
    document.getElementById('login').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, btn = f.querySelector('button');
      btn.disabled = true;
      db.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value }).then(function (res) {
        if (res.error) viewLogin('الإيميل أو كلمة السر غلط'); else boot();
      });
    });
  }
  function boot() {
    root.innerHTML = '<div class="empty">جارى التحميل...</div>';
    db.auth.getSession().then(function (res) {
      if (!res.data.session) { viewLogin(); return; }
      db.rpc('is_admin').then(function (r) {
        if (r.error || !r.data) {
          db.auth.signOut().then(function () { viewLogin('الحساب ده مش مسجل كأدمن'); });
        } else loadAll();
      });
    });
  }
  function loadAll() {
    Promise.all([
      db.from('parts').select('*').order('id', { ascending: false }),
      db.from('orders').select('*').order('id', { ascending: false }).limit(200),
    ]).then(function (res) {
      if (res[0].error || res[1].error) { root.innerHTML = '<div class="empty">تعذر تحميل البيانات، جرب تحديث الصفحة</div>'; return; }
      parts = res[0].data; orders = res[1].data;
      render();
    });
  }

  // ---------- الهيكل ----------
  function render() {
    var newOrders = orders.filter(function (o) { return o.status === 'new'; }).length;
    root.innerHTML = '<div class="tabs">' +
      '<button class="btn ' + (tab === 'parts' ? '' : 'ghost') + '" data-tab="parts">القطع (' + parts.length + ')</button>' +
      '<button class="btn ' + (tab === 'orders' ? '' : 'ghost') + '" data-tab="orders">الطلبات' + (newOrders ? ' <span class="badge">' + newOrders + '</span>' : '') + '</button>' +
      '<button class="btn ghost" id="logout">خروج</button></div><div id="body"></div>';
    root.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { tab = b.getAttribute('data-tab'); render(); });
    });
    document.getElementById('logout').addEventListener('click', function () { db.auth.signOut().then(function () { viewLogin(); }); });
    if (tab === 'parts') renderParts(); else renderOrders();
  }

  // ---------- القطع ----------
  function renderParts() {
    var body = document.getElementById('body');
    body.innerHTML = '<button class="btn block" id="new">＋ إضافة قطعة جديدة</button>' +
      '<input id="q" type="search" placeholder="ابحث فى القطع" value="' + esc(q) + '" style="margin:10px 0"><div id="plist"></div>';
    document.getElementById('new').addEventListener('click', function () { viewForm(null); });
    document.getElementById('q').addEventListener('input', function (e) { q = e.target.value; listParts(); });
    listParts();
  }
  function listParts() {
    var box = document.getElementById('plist'), needle = q.trim().toLowerCase();
    var list = parts.filter(function (p) {
      return !needle || [p.name, p.brand, p.model, p.category, 'P' + p.id].join(' ').toLowerCase().indexOf(needle) >= 0;
    });
    box.innerHTML = list.length ? list.map(function (p) {
      return '<div class="panel arow"><div class="thumb">' + (p.images[0] ? '<img src="' + esc(p.images[0]) + '" alt="">' : '🔩') + '</div>' +
        '<div class="grow"><strong>' + esc(p.name) + '</strong> <span class="tag' + (p.sold ? ' sold' : '') + '">' + (p.sold ? 'تم البيع' : 'متاحة') + '</span>' +
        '<div class="meta">' + esc(p.brand) + ' ' + esc(p.model) + ' · كود P' + p.id + '</div>' +
        '<div class="price">' + money(p.price) + '</div>' +
        '<div class="actions"><button class="btn small ghost" data-act="sold" data-id="' + p.id + '">' + (p.sold ? 'رجّعها متاحة' : 'تم البيع') + '</button>' +
        '<button class="btn small ghost" data-act="edit" data-id="' + p.id + '">تعديل</button>' +
        '<button class="btn small ghost" data-act="del" data-id="' + p.id + '">حذف</button></div></div></div>';
    }).join('') : '<div class="empty">لا توجد قطع</div>';
    box.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = parts.filter(function (x) { return String(x.id) === b.getAttribute('data-id'); })[0];
        var act = b.getAttribute('data-act');
        if (act === 'edit') viewForm(p);
        else if (act === 'sold') toggleSold(p, b);
        else removePart(p, b);
      });
    });
  }
  function toggleSold(p, btn) {
    btn.disabled = true;
    db.from('parts').update({ sold: !p.sold }).eq('id', p.id).then(function (res) {
      if (res.error) { fail('تعذر الحفظ', res.error); btn.disabled = false; return; }
      p.sold = !p.sold; listParts();
    });
  }
  function storagePath(url) { var i = url.indexOf('/object/public/parts/'); return i < 0 ? null : decodeURIComponent(url.slice(i + 21)); }
  function removePart(p, btn) {
    if (!confirm('حذف القطعة «' + p.name + '» نهائيا؟')) return;
    btn.disabled = true;
    db.from('parts').delete().eq('id', p.id).then(function (res) {
      if (res.error) { fail('تعذر الحذف', res.error); btn.disabled = false; return; }
      var paths = p.images.map(storagePath).filter(Boolean);
      if (paths.length) db.storage.from('parts').remove(paths);
      parts = parts.filter(function (x) { return x.id !== p.id; });
      render();
    });
  }

  // ---------- نموذج القطعة ----------
  // تصغير الصورة قبل الرفع عشان الموقع يفضل سريع
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
  function uploadOne(file) {
    return shrink(file).then(function (blob) {
      var path = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
      return db.storage.from('parts').upload(path, blob, { contentType: 'image/jpeg' }).then(function (res) {
        if (res.error) throw res.error;
        return db.storage.from('parts').getPublicUrl(path).data.publicUrl;
      });
    });
  }
  function viewForm(p) {
    var imgs = p ? p.images.slice() : [], removed = [];
    var v = p || { name: '', brand: '', model: '', year_from: '', year_to: '', category: '', condition: 'جيدة جدا', price: '', description: '', sold: false };
    root.innerHTML = '<form class="panel" id="pf"><h2>' + (p ? 'تعديل قطعة' : 'قطعة جديدة') + '</h2>' +
      '<label class="field"><span>اسم القطعة</span><input name="name" value="' + esc(v.name) + '"></label>' +
      '<label class="field"><span>الماركة</span><input name="brand" list="dl-brand" value="' + esc(v.brand) + '"></label>' +
      '<label class="field"><span>الموديل</span><input name="model" list="dl-model" value="' + esc(v.model) + '"></label>' +
      '<div class="two"><label class="field"><span>من سنة</span><input name="year_from" type="number" inputmode="numeric" value="' + esc(v.year_from) + '"></label>' +
      '<label class="field"><span>إلى سنة</span><input name="year_to" type="number" inputmode="numeric" value="' + esc(v.year_to) + '"></label></div>' +
      '<label class="field"><span>نوع القطعة</span><input name="category" list="dl-cat" value="' + esc(v.category) + '"></label>' +
      '<label class="field"><span>الحالة</span><select name="condition">' + CONDITIONS.map(function (c) { return '<option' + (c === v.condition ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>السعر بالجنيه</span><input name="price" type="number" inputmode="decimal" min="0" value="' + esc(v.price) + '"></label>' +
      '<label class="field"><span>الوصف</span><textarea name="description" rows="3">' + esc(v.description) + '</textarea></label>' +
      '<label class="check" style="margin-bottom:10px"><input name="sold" type="checkbox"' + (v.sold ? ' checked' : '') + '> القطعة اتباعت</label>' +
      '<div class="field"><span>الصور</span><div id="imgs" class="thumbs"></div>' +
      '<input name="files" type="file" accept="image/*" multiple></div>' +
      datalist('dl-brand', BRANDS.concat(parts.map(function (x) { return x.brand; }))) +
      datalist('dl-model', parts.map(function (x) { return x.model; })) +
      datalist('dl-cat', CATEGORIES.concat(parts.map(function (x) { return x.category; }))) +
      '<div class="err" id="err"></div><div class="two"><button class="btn" type="submit">حفظ</button>' +
      '<button class="btn ghost" type="button" id="cancel">إلغاء</button></div></form>';
    function drawImgs() {
      var box = document.getElementById('imgs');
      box.innerHTML = imgs.map(function (u, i) {
        return '<div class="thumb"><img src="' + esc(u) + '" alt=""><button type="button" data-i="' + i + '" title="حذف الصورة">×</button></div>';
      }).join('');
      box.querySelectorAll('button').forEach(function (b) {
        b.addEventListener('click', function () { removed.push(imgs.splice(Number(b.getAttribute('data-i')), 1)[0]); drawImgs(); });
      });
    }
    drawImgs();
    document.getElementById('cancel').addEventListener('click', render);
    document.getElementById('pf').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, err = document.getElementById('err'), btn = f.querySelector('button[type=submit]');
      var row = {
        name: f.name.value.trim(), brand: f.brand.value.trim(), model: f.model.value.trim(),
        year_from: f.year_from.value ? Number(f.year_from.value) : null,
        year_to: f.year_to.value ? Number(f.year_to.value) : null,
        category: f.category.value.trim(), condition: f.condition.value,
        price: Number(f.price.value), description: f.description.value.trim(), sold: f.sold.checked,
      };
      if (!row.name) { err.textContent = 'اكتب اسم القطعة'; return; }
      if (f.price.value === '' || isNaN(row.price) || row.price < 0) { err.textContent = 'اكتب السعر بالأرقام'; return; }
      if (row.year_from && row.year_to && row.year_from > row.year_to) { err.textContent = 'سنة البداية لازم تكون قبل سنة النهاية'; return; }
      btn.disabled = true; err.textContent = 'جارى الحفظ ورفع الصور...';
      Promise.all(Array.prototype.map.call(f.files.files, uploadOne)).then(function (urls) {
        row.images = imgs.concat(urls);
        var query = p ? db.from('parts').update(row).eq('id', p.id) : db.from('parts').insert(row);
        return query.select().single();
      }).then(function (res) {
        if (res.error) throw res.error;
        var paths = removed.map(storagePath).filter(Boolean);
        if (paths.length) db.storage.from('parts').remove(paths);
        if (p) parts = parts.map(function (x) { return x.id === p.id ? res.data : x; }); else parts.unshift(res.data);
        tab = 'parts'; render();
      }).catch(function (error) {
        btn.disabled = false; err.textContent = 'تعذر الحفظ: ' + (error && error.message ? error.message : 'خطأ غير معروف');
      });
    });
    window.scrollTo(0, 0);
  }

  // ---------- الطلبات ----------
  function renderOrders() {
    var body = document.getElementById('body');
    body.innerHTML = orders.length ? orders.map(function (o) {
      var wa = 'https://wa.me/2' + encodeURIComponent(o.phone);
      return '<div class="panel"><div class="row"><strong>طلب رقم ' + o.id + '</strong><span class="meta">' + new Date(o.created_at).toLocaleString('ar-EG') + '</span></div>' +
        '<div>' + esc(o.customer_name) + ' — <a href="tel:' + esc(o.phone) + '">' + esc(o.phone) + '</a> · <a target="_blank" rel="noopener" href="' + wa + '">واتساب</a></div>' +
        '<div class="meta">' + esc(o.city) + ' — ' + esc(o.address) + '</div>' +
        (o.notes ? '<div class="meta">ملاحظات: ' + esc(o.notes) + '</div>' : '') +
        '<ul>' + (o.items || []).map(function (it) { return '<li>' + esc(it.name) + ' (' + esc(it.brand) + ' ' + esc(it.model) + ') كود P' + esc(it.id) + ' — ' + money(it.price) + '</li>'; }).join('') + '</ul>' +
        '<div class="row"><span>' + esc(PAY[o.pay_method] || o.pay_method) + '</span><span class="total">' + money(o.total) + '</span></div>' +
        '<label class="field"><span>حالة الطلب</span><select data-order="' + o.id + '">' + Object.keys(STATUS).map(function (k) {
          return '<option value="' + k + '"' + (k === o.status ? ' selected' : '') + '>' + STATUS[k] + '</option>';
        }).join('') + '</select></label></div>';
    }).join('') : '<div class="empty">لا توجد طلبات حتى الآن</div>';
    body.querySelectorAll('[data-order]').forEach(function (s) {
      s.addEventListener('change', function () {
        var o = orders.filter(function (x) { return String(x.id) === s.getAttribute('data-order'); })[0];
        db.from('orders').update({ status: s.value }).eq('id', o.id).then(function (res) {
          if (res.error) { fail('تعذر الحفظ', res.error); s.value = o.status; return; }
          o.status = s.value; render();
        });
      });
    });
  }

  boot();
})();
