(function () {
  'use strict';

  // The photo gallery's lightbox (layouts/gallery.html).
  document.addEventListener('DOMContentLoaded', function () {
    if (window.GLightbox) {
      GLightbox({ selector: '.glightbox' });
    }
  });
})();
