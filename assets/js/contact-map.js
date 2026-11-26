(function () {
  'use strict';

  // The contact page's map (layouts/contact.html). The page may show a
  // snapshot of the map straight away; once the page has loaded, fetch
  // Leaflet and draw the live map on top of it.
  var el = document.getElementById('contact-map');
  if (!el) return;

  function loadLeaflet() {
    var pending = 2;
    function done() {
      pending -= 1;
      if (pending === 0) drawMap();
    }

    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = el.dataset.leafletCss;
    css.integrity = el.dataset.leafletCssIntegrity;
    css.onload = done;
    document.head.appendChild(css);

    var js = document.createElement('script');
    js.src = el.dataset.leafletJs;
    js.integrity = el.dataset.leafletJsIntegrity;
    js.onload = done;
    document.head.appendChild(js);
  }

  function drawMap() {
    var center = [parseFloat(el.dataset.lat), parseFloat(el.dataset.lng)];

    // Scrolling the page shouldn't zoom the map, and on touch screens one
    // finger should scroll the page rather than pan the map (pinch still
    // zooms, and the +/- buttons work everywhere).
    var map = L.map(el, {
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
    }).setView(center, parseInt(el.dataset.zoom, 10));

    var tiles = L.tileLayer(el.dataset.tiles, {
      maxZoom: 19,
      attribution: el.dataset.attribution,
    }).addTo(map);

    // A custom pin if the site has one ([params.map] pin), else Leaflet's.
    var options = { title: el.dataset.title, alt: el.dataset.title };
    if (el.dataset.pin) {
      var width = parseInt(el.dataset.pinWidth, 10);
      var height = parseInt(el.dataset.pinHeight, 10);
      options.icon = L.icon({
        iconUrl: el.dataset.pin,
        iconSize: [width, height],
        iconAnchor: [Math.round(width / 2), height],
      });
    }
    L.marker(center, options).addTo(map);

    // Once the tiles cover the snapshot, remove it (and the credit, which
    // Leaflet's attribution now covers), so panning shows the live map.
    tiles.once('load', function () {
      el.classList.add('contact-map--live');
    });
  }

  if (document.readyState === 'complete') loadLeaflet();
  else window.addEventListener('load', loadLeaflet);
})();
