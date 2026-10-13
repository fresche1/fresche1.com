// FRESCHE idioma (ES/EN) compartido por todas las páginas. Misma clave que la tienda: 'fresche_lang'.
// Marcado: data-es/data-en (contenido), data-es-alt/-en-alt, data-es-aria/-en-aria, data-es-ph/-en-ph,
// data-es-title/-en-title (atributo title), data-es-content/-en-content (meta). Clases .es/.en se ocultan por CSS.
(function () {
  function detect() {
    try { var s = localStorage.getItem('fresche_lang'); if (s === 'es' || s === 'en') return s; } catch (e) {}
    return (navigator.language || '').toLowerCase().indexOf('en') === 0 ? 'en' : 'es';
  }
  var st = document.createElement('style');
  st.textContent = 'html[data-lang="es"] .en,html[data-lang="en"] .es{display:none!important}';
  document.head.appendChild(st);
  var FL = window.FL = {
    lang: detect(),
    t: function (es, en) { return FL.lang === 'en' ? en : es; },
    apply: function (l) {
      if (l) FL.lang = l === 'en' ? 'en' : 'es';
      var L = FL.lang, h = document.documentElement;
      h.setAttribute('data-lang', L); h.lang = L;
      try { localStorage.setItem('fresche_lang', L); } catch (e) {}
      document.querySelectorAll('[data-es][data-en]').forEach(function (e) {
        if (e.tagName === 'META') e.setAttribute('content', e.getAttribute('data-' + L));
        else if (e.tagName === 'TITLE') e.textContent = e.getAttribute('data-' + L);
        else e.innerHTML = e.getAttribute('data-' + L);
      });
      [['alt', 'alt'], ['aria', 'aria-label'], ['ph', 'placeholder'], ['title', 'title'], ['content', 'content']].forEach(function (a) {
        document.querySelectorAll('[data-' + L + '-' + a[0] + ']').forEach(function (e) { e.setAttribute(a[1], e.getAttribute('data-' + L + '-' + a[0])); });
      });
    }
  };
  var h0 = document.documentElement; h0.setAttribute('data-lang', FL.lang); h0.lang = FL.lang;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { FL.apply(); }); else FL.apply();
})();
