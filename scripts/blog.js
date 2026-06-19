'use strict';

/* ── Article category filter ──────────────────────── */
var filterButtons = document.querySelectorAll('.category-filter__btn');
var articles      = document.querySelectorAll('.article-card');
var noResults     = document.getElementById('no-results');

if (filterButtons.length && articles.length) {
  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var filter = btn.getAttribute('data-filter');

      filterButtons.forEach(function (b) {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');

      var visibleCount = 0;

      articles.forEach(function (card) {
        var cat = card.getAttribute('data-category');
        var show = filter === 'all' || cat === filter;
        card.classList.toggle('is-hidden', !show);
        if (show) visibleCount++;
      });

      if (noResults) noResults.hidden = visibleCount > 0;
    });
  });
}
