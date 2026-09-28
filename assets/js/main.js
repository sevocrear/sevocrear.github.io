(function () {
  'use strict';

  var root = document.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }

  /* ---------------- i18n ---------------- */
  var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-i18n]'));
  var EN = {};
  nodes.forEach(function (n) { EN[n.getAttribute('data-i18n')] = n.innerHTML; });
  EN['meta.title'] = document.title;
  var metaDesc = document.querySelector('meta[name="description"]');
  EN['meta.desc'] = metaDesc ? metaDesc.content : '';
  var DICT = { en: EN, ru: window.I18N_RU || {} };

  function pickLang() {
    var q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'ru') return q;
    var s = store('lang');
    if (s === 'en' || s === 'ru') return s;
    return (navigator.language || '').toLowerCase().indexOf('ru') === 0 ? 'ru' : 'en';
  }

  var lang = 'en';
  function setLang(l, persist) {
    lang = l;
    var d = DICT[l];
    nodes.forEach(function (n) {
      var k = n.getAttribute('data-i18n');
      var v = d[k] != null ? d[k] : EN[k];
      if (v != null && n.innerHTML !== v) n.innerHTML = v;
    });
    root.lang = l;
    document.title = d['meta.title'] || EN['meta.title'];
    if (metaDesc) metaDesc.content = d['meta.desc'] || EN['meta.desc'];
    document.querySelectorAll('[data-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === l));
    });
    if (persist) store('lang', l);
    typeRole();
  }
  document.querySelectorAll('[data-lang]').forEach(function (b) {
    b.addEventListener('click', function () { setLang(b.getAttribute('data-lang'), true); });
  });

  /* ---------------- typed role ---------------- */
  var typed = document.getElementById('typed');
  var typeTimer = null;
  function typeRole() {
    if (!typed) return;
    var full = typed.textContent;
    if (reduced) return;
    clearTimeout(typeTimer);
    var i = 0;
    typed.textContent = '';
    (function tick() {
      typed.textContent = full.slice(0, ++i);
      if (i < full.length) typeTimer = setTimeout(tick, 38 + Math.random() * 40);
    })();
  }

  /* ---------------- theme ---------------- */
  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var t = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', t);
    store('theme', t);
  });

  /* ---------------- boot line ---------------- */
  var boot = document.getElementById('bootLine');
  var bootSteps = [
    '> init perception_stack',
    ' · cameras[6] ok',
    ' · lidar ok',
    ' · tensorrt engine fp16 ok',
    ' · ros2 graph ok',
    ' · mot3d tracker ok',
    ' — all systems nominal'
  ];
  if (boot) {
    if (reduced) boot.textContent = bootSteps.join('');
    else {
      var bi = 0;
      (function step() {
        if (bi >= bootSteps.length) return;
        var s = bootSteps[bi++];
        var span = document.createElement('span');
        if (/ok$|nominal$/.test(s)) {
          span.innerHTML = s.replace(/(ok|all systems nominal)$/, '<span class="ok">$1</span>');
        } else span.textContent = s;
        boot.appendChild(span);
        setTimeout(step, 260 + Math.random() * 280);
      })();
    }
  }

  /* ---------------- reveal + active nav ---------------- */
  var reveals = document.querySelectorAll('.reveal');
  var navLinks = {};
  document.querySelectorAll('.nav__links a').forEach(function (a) { navLinks[a.getAttribute('href').slice(1)] = a; });

  if ('IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); ro.unobserve(e.target); countUp(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { ro.observe(el); });

    var no = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        Object.keys(navLinks).forEach(function (k) { navLinks[k].classList.toggle('is-active', k === e.target.id); });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(function (s) { no.observe(s); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ---------------- count-up metrics ---------------- */
  function countUp(scope) {
    if (reduced) return;
    scope.querySelectorAll('[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var dec = (el.getAttribute('data-count').split('.')[1] || '').length;
      var pre = el.getAttribute('data-prefix') || '';
      var suf = el.getAttribute('data-suffix') || '';
      var t0 = performance.now(), dur = 1400;
      (function frame(now) {
        var p = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = pre + (target * e).toFixed(dec) + suf;
        if (p < 1) requestAnimationFrame(frame);
      })(t0);
    });
  }

  /* ---------------- card hover glow ---------------- */
  document.querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------------- HUD detection overlay ---------------- */
  (function hud() {
    var box = document.getElementById('bbox');
    if (!box || reduced) return;
    var trail = document.getElementById('trail');
    var conf = document.getElementById('conf');
    var fps = document.getElementById('fps');
    var lat = document.getElementById('lat');
    var coords = document.getElementById('coords');

    // face box in % of the photo
    var FACE = { x: 42, y: 12.4, w: 20.1, h: 30 };
    var pts = [];
    var seeking = false;

    function place(b) {
      box.style.setProperty('--x', b.x + '%');
      box.style.setProperty('--y', b.y + '%');
      box.style.setProperty('--w', b.w + '%');
      box.style.setProperty('--h', b.h + '%');
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      pts.push(cx.toFixed(2) + ',' + cy.toFixed(2));
      if (pts.length > 24) pts.shift();
      trail.setAttribute('points', pts.join(' '));
      coords.textContent = 'x:' + (cx / 100).toFixed(2) + ' y:' + (cy / 100).toFixed(2);
    }
    function j(a) { return (Math.random() - 0.5) * a; }

    function track() {
      if (!seeking && !document.hidden) {
        place({ x: FACE.x + j(0.8), y: FACE.y + j(0.8), w: FACE.w + j(0.6), h: FACE.h + j(0.6) });
        conf.textContent = (0.96 + Math.random() * 0.035).toFixed(2);
        fps.textContent = String(58 + Math.round(Math.random() * 4));
        lat.textContent = (1.9 + Math.random() * 0.5).toFixed(1);
      }
      setTimeout(track, 180);
    }

    // every few seconds: lose the target, sweep, re-acquire
    function reacquire() {
      if (document.hidden) return setTimeout(reacquire, 3000);
      seeking = true;
      box.classList.add('is-seeking');
      conf.textContent = '0.41';
      var hops = [
        { x: 18 + Math.random() * 10, y: 50 + Math.random() * 10, w: 30, h: 36 },
        { x: 52 + Math.random() * 10, y: 30 + Math.random() * 10, w: 26, h: 30 },
        FACE
      ];
      var k = 0;
      (function hop() {
        place(hops[k]);
        if (++k < hops.length) return setTimeout(hop, 520);
        setTimeout(function () { box.classList.remove('is-seeking'); seeking = false; }, 520);
      })();
      setTimeout(reacquire, 7000 + Math.random() * 4000);
    }

    box.classList.add('is-seeking');
    place({ x: 5, y: 5, w: 90, h: 90 });
    setTimeout(function () {
      place(FACE);
      setTimeout(function () { box.classList.remove('is-seeking'); track(); }, 600);
    }, 500);
    setTimeout(reacquire, 6500);
  })();

  /* ---------------- LiDAR background ---------------- */
  (function lidar() {
    var cv = document.getElementById('bg');
    if (!cv || reduced || !cv.getContext) return;
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 1.5);

    // ground rings + a few obstacle clusters (world units: metres; y up)
    var P = [];
    for (var r = 3; r <= 34; r += 1.4) {
      var n = Math.floor(r * 9);
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 + Math.random() * 0.01;
        P.push([Math.cos(a) * r, 0 + (Math.random() - 0.5) * 0.05, Math.sin(a) * r, a]);
      }
    }
    function cluster(cx, cz, w, d, h) {
      for (var k = 0; k < 160; k++) {
        var side = Math.random() < 0.5;
        var x = cx + (side ? (Math.random() < 0.5 ? -w : w) / 2 : (Math.random() - 0.5) * w);
        var z = cz + (side ? (Math.random() - 0.5) * d : (Math.random() < 0.5 ? -d : d) / 2);
        P.push([x, Math.random() * h, z, Math.atan2(z, x)]);
      }
    }
    cluster(7, 4, 1.9, 4.4, 1.5);
    cluster(-6, 10, 1.9, 4.6, 1.6);
    cluster(11, -8, 2.4, 6, 2.8);
    cluster(-12, -5, 0.6, 0.6, 1.8);
    cluster(3, 16, 1.9, 4.2, 1.5);

    function resize() {
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    var TAU = Math.PI * 2;
    var rot = 0, sweep = 0, last = performance.now(), raf = 0;
    var pitch = 0.32, camY = 4.2, camZ = -14;
    var cp = Math.cos(pitch), sp = Math.sin(pitch);

    function frame(now) {
      var dt = Math.min(50, now - last); last = now;
      rot += dt * 0.00004;
      sweep = (sweep + dt * 0.0016) % TAU;

      var rgb = getComputedStyle(root).getPropertyValue('--canvas-dot').trim() || '60, 240, 255';
      ctx.clearRect(0, 0, W, H);
      var f = Math.max(W, H) * 0.9;
      var cx = W * 0.62, hy = H * 0.5;
      var cr = Math.cos(rot), sr = Math.sin(rot);

      for (var i = 0; i < P.length; i++) {
        var p = P[i];
        var x = p[0] * cr - p[2] * sr;
        var z = p[0] * sr + p[2] * cr;
        var y = p[1] - camY, zc = z - camZ;
        var y2 = y * cp + zc * sp;
        var z2 = -y * sp + zc * cp;
        if (z2 < 1) continue;
        var sx = cx + (x / z2) * f, sy = hy - (y2 / z2) * f;
        if (sx < -4 || sx > W + 4 || sy < -4 || sy > H + 4) continue;

        // brightness from the rotating beam (trailing decay)
        var ang = ((p[3] + rot) % TAU + TAU) % TAU;
        var d = (sweep - ang + TAU) % TAU;
        var beam = d < 1.4 ? 1 - d / 1.4 : 0;
        var depth = Math.max(0, 1 - z2 / 60);
        var alpha = 0.05 + depth * 0.18 + beam * 0.55 * depth;
        if (p[1] > 0.1) alpha += 0.12 * depth;
        var s = (0.6 + depth * 1.4) * (1 + beam * 0.5);
        ctx.fillStyle = 'rgba(' + rgb + ',' + alpha.toFixed(3) + ')';
        ctx.fillRect(sx, sy, s, s);
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) cancelAnimationFrame(raf);
      else { last = performance.now(); raf = requestAnimationFrame(frame); }
    });
  })();

  /* ---------------- start ---------------- */
  setLang(pickLang(), false);
})();
