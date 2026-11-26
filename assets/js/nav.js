(function () {
  'use strict';

  var toggle = document.querySelector('.navbar__toggle');
  var menu = document.getElementById('primary-menu');

  // The phone menu slides open and shut over 350ms; submenus open
  // instantly.
  var SLIDE_MS = 350;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var slideRun = 0;

  function clearSlide(el) {
    el.style.overflow = '';
    el.style.transition = '';
    el.style.height = '';
  }

  // Animates the height of `box`, an unpadded wrapper, while `content`
  // inside it is shown or hidden by its is-open class (the menu list's own
  // padding would otherwise keep it from collapsing to zero).
  function slide(box, content, open) {
    var run = ++slideRun;
    if (reduceMotion.matches) {
      content.classList.toggle('is-open', open);
      clearSlide(box);
      return;
    }
    // Start from the current height, so a second tap mid-slide reverses
    // smoothly instead of jumping.
    var start = box.offsetHeight;
    content.classList.add('is-open');
    box.style.overflow = 'hidden';
    box.style.transition = 'none';
    box.style.height = start + 'px';
    var end = open ? box.scrollHeight : 0;
    box.getBoundingClientRect(); // apply the start height before animating
    box.style.transition = 'height ' + SLIDE_MS + 'ms ease';
    box.style.height = end + 'px';
    setTimeout(function () {
      if (run !== slideRun) return;
      if (!open) content.classList.remove('is-open');
      clearSlide(box);
    }, SLIDE_MS);
  }

  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      slide(menu.parentElement, menu, open);
    });
  }

  document.querySelectorAll('.navbar__caret').forEach(function (caret) {
    caret.addEventListener('click', function () {
      var submenu = caret.parentElement.querySelector('.navbar__submenu');
      if (!submenu) return;
      var open = submenu.classList.toggle('is-open');
      caret.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  // Escape closes a dropdown opened by hover or keyboard focus (WCAG 1.4.13).
  // It stays shut until both the pointer and focus have left it; on phones
  // it closes an opened submenu and puts focus back on its button.
  var dropdowns = document.querySelectorAll('.navbar__item--dropdown, .navbar__subitem--dropdown');

  function reopen(item) {
    if (!item.matches(':hover') && !item.contains(document.activeElement)) {
      item.classList.remove('is-dismissed');
    }
  }

  dropdowns.forEach(function (item) {
    item.addEventListener('mouseleave', function () {
      reopen(item);
    });
    item.addEventListener('focusout', function () {
      setTimeout(function () {
        reopen(item);
      }, 0);
    });
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    dropdowns.forEach(function (item) {
      var focused = item.contains(document.activeElement);
      if (!focused && !item.matches(':hover')) return;
      var submenu = item.querySelector(':scope > .navbar__submenu.is-open');
      var caret = item.querySelector(':scope > .navbar__caret');
      if (submenu) {
        submenu.classList.remove('is-open');
        if (caret) {
          caret.setAttribute('aria-expanded', 'false');
          caret.focus();
        }
        return;
      }
      item.classList.add('is-dismissed');
      if (focused) item.querySelector(':scope > a').focus();
    });
  });

  // Bfcache restores the DOM exactly as it was left, so a menu opened
  // before navigating away would otherwise still show as open when the
  // user comes back via the browser's back/forward button.
  window.addEventListener('pageshow', function () {
    if (menu) {
      slideRun++;
      menu.classList.remove('is-open');
      clearSlide(menu.parentElement);
    }
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
    }
    document.querySelectorAll('.navbar__submenu.is-open').forEach(function (submenu) {
      submenu.classList.remove('is-open');
      var caret = submenu.parentElement.querySelector('.navbar__caret');
      if (caret) {
        caret.setAttribute('aria-expanded', 'false');
      }
    });
  });
})();
