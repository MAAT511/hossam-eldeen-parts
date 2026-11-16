// بيانات المحل: غيّر القيم اللى بين علامات التنصيص فقط
window.SHOP = {
  name: 'حسام الدين لقطع غيار الفولكس والاسكودا',
  tagline: 'متخصص فى بيع قطع غيار السيارات الألمانى استيراد الخارج',
  address: '44 شارع عمار بن ياسر، آخر نزلة الريحانى، الحرفيين، السلام، القاهرة',
  // أرقام التليفون اللى تظهر تحت فى الموقع
  phones: [
    { label: 'باسم', number: '01159016664' },
    { label: 'عبده', number: '01097096594' },
  ],
  // رقم الواتساب بكود مصر ومن غير علامة + ومن غير صفر فى الأول
  whatsapp: '201159016664',
  facebook: 'https://www.facebook.com/profile.php?id=61552677182094',
  // رابط موقع المحل على خرائط جوجل
  mapLink: 'https://maps.app.goo.gl/NLEwaxkTtH2L5Z95A',
  // مواعيد العمل (سيبها فاضية لو مش عاوز تظهر)
  hours: 'من الاثنين إلى السبت، من 10 صباحا إلى 11 مساء',
  // رقم التحويل إنستاباى (لو فاضى العميل ياخده من الواتساب)
  transferNumber: '01092617807',
  // صور المحل اللى تظهر فى الصفحة الرئيسية
  gallery: ['images/shop-1.jpg', 'images/shop-2.jpg', 'images/shop-3.jpg', 'images/shop-4.jpg', 'images/shop-5.jpg'],
  // ربط قاعدة البيانات Supabase (لو فاضيين الموقع يعرض القطع التجريبية من parts.js)
  supabaseUrl: 'https://vcubvevyiiodyfumhcde.supabase.co',
  supabaseKey: 'sb_publishable_FK3DGQFRX4CdGWLzvCxGug_whHxeLDR',
};
