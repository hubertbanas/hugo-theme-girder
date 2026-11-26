(function () {
  'use strict';

  // The home page hero (layouts/_partials/hero-carousel.html). Moves to the
  // next slide every data-interval ms. It stops while the pointer is over the
  // carousel or focus is inside it, while the pause button says so, and
  // altogether for visitors who prefer reduced motion.
  var MOVE_MS = 600;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    var track = root.querySelector('.carousel__track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.carousel__slide'));
    var pauseButton = root.querySelector('.carousel__pause');
    var interval = parseInt(root.dataset.interval, 10) || 5000;
    if (slides.length < 2) return;

    root.classList.add('carousel--ready');
    var current = 0;
    var moving = false;
    var timer = null;
    var pausedByUser = reduceMotion.matches;
    var hovered = false;
    var focused = false;

    function playing() {
      return !pausedByUser && !hovered && !focused && !document.hidden;
    }

    function schedule() {
      clearTimeout(timer);
      timer = null;
      if (playing()) timer = setTimeout(next, interval);
      // Screen readers announce a slide change only while the carousel isn't
      // moving by itself.
      track.setAttribute('aria-live', pausedByUser ? 'polite' : 'off');
    }

    function finish(from, to, nextClass, leaveClass) {
      from.classList.remove('is-active', leaveClass);
      to.classList.remove(nextClass, 'is-entering');
      to.classList.add('is-active');
      moving = false;
      schedule();
    }

    function show(index, direction) {
      if (moving || index === current) return;
      var from = slides[current];
      var to = slides[index];
      current = index;

      if (reduceMotion.matches) {
        from.classList.remove('is-active');
        to.classList.add('is-active');
        schedule();
        return;
      }

      moving = true;
      var nextClass = direction === 'next' ? 'is-next' : 'is-prev';
      var leaveClass = direction === 'next' ? 'is-leaving-left' : 'is-leaving-right';
      to.classList.add(nextClass);
      to.getBoundingClientRect(); // place it beside the current slide first
      to.classList.add('is-entering');
      from.classList.add(leaveClass);
      setTimeout(function () {
        finish(from, to, nextClass, leaveClass);
      }, MOVE_MS);
    }

    function next() {
      show((current + 1) % slides.length, 'next');
    }

    function prev() {
      show((current - 1 + slides.length) % slides.length, 'prev');
    }

    // The buttons stay hidden in the markup until this script runs, since
    // they do nothing without it.
    root.querySelectorAll('.carousel__control, .carousel__pause').forEach(function (button) {
      button.hidden = false;
    });
    root.querySelector('.carousel__control--next').addEventListener('click', next);
    root.querySelector('.carousel__control--prev').addEventListener('click', prev);

    function setPaused(paused) {
      pausedByUser = paused;
      root.classList.toggle('is-paused', paused);
      if (pauseButton) {
        pauseButton.setAttribute('aria-label', paused ? 'Play slides' : 'Pause slides');
      }
      schedule();
    }

    if (pauseButton) {
      pauseButton.addEventListener('click', function () {
        setPaused(!pausedByUser);
      });
    }

    root.addEventListener('mouseenter', function () {
      hovered = true;
      schedule();
    });
    root.addEventListener('mouseleave', function () {
      hovered = false;
      schedule();
    });
    root.addEventListener('focusin', function () {
      focused = true;
      schedule();
    });
    root.addEventListener('focusout', function (event) {
      if (!root.contains(event.relatedTarget)) {
        focused = false;
        schedule();
      }
    });
    document.addEventListener('visibilitychange', schedule);

    setPaused(pausedByUser);
  });
})();
