// Dil seçimi: kayıtlı tercih, yoksa tarayıcı dili (tr), yoksa İngilizce.
(function () {
  var root = document.documentElement;
  var lang = null;
  try { lang = localStorage.getItem('oh-lang'); } catch (e) {}
  if (!lang) lang = (navigator.language || '').toLowerCase().indexOf('tr') === 0 ? 'tr' : 'en';
  root.setAttribute('data-lang', lang);
  root.setAttribute('lang', lang);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-set]');
    if (!b) return;
    var l = b.getAttribute('data-set');
    root.setAttribute('data-lang', l);
    root.setAttribute('lang', l);
    try { localStorage.setItem('oh-lang', l); } catch (err) {}
  });
})();
