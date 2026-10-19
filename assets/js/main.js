/* ==========================================================================
   交互脚本：主题、移动导航、滚动显现、目录高亮、阅读进度
   无依赖，所有增强在 JS 失效时不影响内容阅读。
   ========================================================================== */

(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- 主题 */
  var themeToggle = document.getElementById('themeToggle');

  function setTheme(mode) {
    root.dataset.theme = mode;
    try { localStorage.setItem('theme', mode); } catch (e) { /* 忽略 */ }
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
    });
  }

  /* ------------------------------------------------------------ 移动导航 */
  var navToggle = document.getElementById('navToggle');
  var nav = document.getElementById('primaryNav');

  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? '收起导航' : '展开导航');
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.focus();
      }
    });
  }

  /* -------------------------------------------------------- 顶栏吸顶状态 */
  var header = document.getElementById('siteHeader');
  var progress = document.querySelector('.progress');
  var ticking = false;

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;

    if (header) {
      header.classList.toggle('is-stuck', y > 8);
    }

    if (progress) {
      var height = document.documentElement.scrollHeight - window.innerHeight;
      var ratio = height > 0 ? Math.min(y / height, 1) : 0;
      progress.style.width = (ratio * 100).toFixed(2) + '%';
    }

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(onScroll);
    }
  }, { passive: true });

  onScroll();

  /* ------------------------------------------------------------ 滚动显现 */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll('.reveal'));

  if (!reduceMotion && 'IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    revealItems.forEach(function (item) { revealObserver.observe(item); });
  } else {
    revealItems.forEach(function (item) { item.classList.add('is-in'); });
  }

  /* ------------------------------------------------------------ 目录高亮 */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
  var sections = tocLinks
    .map(function (link) { return document.querySelector(link.getAttribute('href')); })
    .filter(Boolean);

  if (tocLinks.length && sections.length && 'IntersectionObserver' in window) {
    var visible = new Map();

    var tocObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible.set(entry.target.id, entry.intersectionRatio);
      });

      var bestId = null;
      var bestRatio = 0;
      visible.forEach(function (ratio, id) {
        if (ratio > bestRatio) { bestRatio = ratio; bestId = id; }
      });

      if (bestId) {
        tocLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + bestId);
        });
      }
    }, { rootMargin: '-96px 0px -55% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] });

    sections.forEach(function (section) { tocObserver.observe(section); });
  }

  /* ------------------------------------------------------------ 卡片光斑 */
  var spotlightItems = Array.prototype.slice.call(document.querySelectorAll('[data-spotlight]'));

  spotlightItems.forEach(function (item) {
    item.addEventListener('pointermove', function (event) {
      var rect = item.getBoundingClientRect();
      item.style.setProperty('--mx', (event.clientX - rect.left) + 'px');
      item.style.setProperty('--my', (event.clientY - rect.top) + 'px');
    });
  });

  /* ------------------------------------------------------------ 数字滚动 */
  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));

  function formatCount(value, decimals) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: false
    });
  }

  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    var duration = 1500;
    var start = null;

    function step(now) {
      if (start === null) { start = now; }
      var p = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatCount(target * eased, decimals);
      if (p < 1) {
        window.requestAnimationFrame(step);
      } else {
        el.textContent = formatCount(target, decimals);
      }
    }

    window.requestAnimationFrame(step);
  }

  if (counters.length) {
    if (reduceMotion || !('IntersectionObserver' in window)) {
      counters.forEach(function (el) {
        el.textContent = formatCount(parseFloat(el.getAttribute('data-count')),
          parseInt(el.getAttribute('data-decimals') || '0', 10));
      });
    } else {
      var countObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            countObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.5 });

      counters.forEach(function (el) { countObserver.observe(el); });
    }
  }

  /* ------------------------------------------------------------ 复制邮箱 */
  var copyBtn = document.getElementById('copyEmail');

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var email = copyBtn.getAttribute('data-email');
      var done = function () {
        var original = copyBtn.innerHTML;
        copyBtn.classList.add('is-done');
        copyBtn.textContent = '已复制';
        window.setTimeout(function () {
          copyBtn.innerHTML = original;
          copyBtn.classList.remove('is-done');
        }, 1800);
      };

      var legacyCopy = function () {
        var field = document.createElement('textarea');
        field.value = email;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        try { document.execCommand('copy'); done(); } catch (e) { /* 忽略 */ }
        document.body.removeChild(field);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).then(done, legacyCopy);
      } else {
        legacyCopy();
      }
    });
  }

  /* ------------------------------------------------------------ 光效亮度 */
  var glowInputs = Array.prototype.slice.call(document.querySelectorAll('[data-glow-range]'));

  glowInputs.forEach(function (input) {
    var host = input.closest('.math-visual');
    var output = host ? host.querySelector('[data-glow-value]') : null;

    var apply = function () {
      var value = Number(input.value) / 100;
      if (host) { host.style.setProperty('--glow', value.toFixed(2)); }
      if (output) { output.textContent = input.value + '%'; }
    };

    input.addEventListener('input', apply);
    apply();
  });

  /* ------------------------------------------------------------ 车身热点 */
  Array.prototype.slice.call(document.querySelectorAll('.hotspot')).forEach(function (spot) {
    var host = spot.closest('.car-visual');
    if (!host) { return; }

    var svg = host.querySelector('.car-svg');
    var part = svg ? svg.querySelector('[data-part="' + spot.getAttribute('data-part') + '"]') : null;
    if (!part) { return; }

    var activate = function () { part.classList.add('is-hot'); };
    var deactivate = function () { part.classList.remove('is-hot'); };

    spot.addEventListener('pointerenter', activate);
    spot.addEventListener('pointerleave', deactivate);
    spot.addEventListener('focus', activate);
    spot.addEventListener('blur', deactivate);
  });

  /* -------------------------------------------------------------- 年份 */
  var year = document.getElementById('year');
  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
})();
