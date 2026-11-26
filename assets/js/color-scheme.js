// The colour scheme: automatic (as the visitor's device; the default), light
// or dark. The header's button steps through them, and the choice is kept in
// localStorage. A chosen scheme is data-color-scheme="light" or "dark" on
// <html> (see assets/scss/_colors.scss); automatic is no attribute.
//
// Loaded in <head> and not deferred, so a chosen scheme is in place before
// the page is first drawn: no flash of the other one.
(function () {
  var KEY = 'color-scheme';
  var root = document.documentElement;
  var names = { auto: 'automatic', light: 'light', dark: 'dark' };
  var device = window.matchMedia('(prefers-color-scheme: dark)');
  var current = 'auto';
  var button;
  var status;

  function load() {
    try {
      var value = localStorage.getItem(KEY);
      current = value === 'light' || value === 'dark' ? value : 'auto';
    } catch {
      // Storage blocked: the choice lasts for this page only.
    }
    if (current === 'auto') root.removeAttribute('data-color-scheme');
    else root.setAttribute('data-color-scheme', current);
  }

  function save() {
    try {
      if (current === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, current);
    } catch {
      // As above.
    }
  }

  function label() {
    if (!button) return;
    var name = 'Colour scheme: ' + names[current];
    button.setAttribute('aria-label', name);
    button.title = name + (current === 'auto' ? ' (as your device)' : '');
  }

  // The first press always changes what's on screen: automatic -> the
  // opposite of the device's scheme -> the device's scheme -> automatic.
  function next() {
    var own = device.matches ? 'dark' : 'light';
    var other = own === 'dark' ? 'light' : 'dark';
    if (current === 'auto') return other;
    if (current === other) return own;
    return 'auto';
  }

  load();

  // A choice made in another tab of the site.
  window.addEventListener('storage', function (event) {
    if (event.key === KEY || event.key === null) {
      load();
      label();
    }
  });

  document.addEventListener('DOMContentLoaded', function () {
    button = document.querySelector('.scheme-toggle');
    if (!button) return;
    status = document.querySelector('.scheme-toggle__status');
    label();
    button.hidden = false;
    button.addEventListener('click', function () {
      current = next();
      save();
      load();
      label();
      if (status) status.textContent = 'Colour scheme: ' + names[current];
    });
  });
})();
