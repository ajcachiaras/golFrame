/* Kiera Anderson — site behaviour.
   Plain ES5-ish browser JS, no build step. Handles the nav, the bag drawer,
   the shop filters and the product page. The bag is per-browser only; there is
   no backend and no checkout, because the brand is fictional. */
(function () {
  "use strict";

  var KA = window.KA || {};
  var BAG_KEY = "ka-bag-v1";
  var INK_LINE = "rgba(36,31,28,.45)";

  /* ------------------------------------------------------------------ utils */

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function money(n) {
    return "$" + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function byId(id) {
    for (var i = 0; i < (KA.PRODUCTS || []).length; i++) {
      if (KA.PRODUCTS[i].id === id) return KA.PRODUCTS[i];
    }
    return null;
  }

  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : null;
  }

  /* localStorage is best-effort: private windows and blocked site data throw. */
  function readBag() {
    try {
      var raw = window.localStorage.getItem(BAG_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(parsed) === "[object Array]" ? parsed : [];
    } catch (e) { return []; }
  }

  function writeBag(lines) {
    try { window.localStorage.setItem(BAG_KEY, JSON.stringify(lines)); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------ garment art */

  function garment(product, colorIndex, cls) {
    var c = product.colors[colorIndex || 0];
    return '<svg class="garment ' + (cls || "") + '" viewBox="0 0 200 200" role="img" ' +
      'aria-label="' + esc(product.name + " in " + c.name) + '" ' +
      'style="--gm:' + c.main + ';--ga:' + c.accent + ';--gl:' + INK_LINE + '">' +
      '<use href="#' + product.shape + '"></use></svg>';
  }

  /* ------------------------------------------------------------------ toast */

  function toast(msg) {
    var rail = $(".toast-rail");
    if (!rail) {
      rail = document.createElement("div");
      rail.className = "toast-rail";
      rail.setAttribute("role", "status");
      rail.setAttribute("aria-live", "polite");
      document.body.appendChild(rail);
    }
    var t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    rail.appendChild(t);
    window.setTimeout(function () {
      t.style.transition = "opacity .3s";
      t.style.opacity = "0";
      window.setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 320);
    }, 2600);
  }

  /* -------------------------------------------------------------------- nav */

  function initNav() {
    var toggle = $(".nav-toggle");
    var nav = $(".nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var open = nav.getAttribute("data-open") === "true";
      nav.setAttribute("data-open", open ? "false" : "true");
      toggle.setAttribute("aria-expanded", open ? "false" : "true");
    });
    /* Mark the current page in the nav without hard-coding it per file. */
    var here = (window.location.pathname.split("/").pop() || "index.html").toLowerCase();
    $$(".nav a").forEach(function (a) {
      var target = (a.getAttribute("href") || "").split("?")[0].toLowerCase();
      if (target && target === here) a.setAttribute("aria-current", "page");
    });
  }

  /* -------------------------------------------------------------------- bag */

  var bag = {
    lines: [],

    load: function () { this.lines = readBag(); this.paint(); },

    count: function () {
      return this.lines.reduce(function (n, l) { return n + l.qty; }, 0);
    },

    total: function () {
      return this.lines.reduce(function (sum, l) {
        var p = byId(l.id);
        return sum + (p ? p.price * l.qty : 0);
      }, 0);
    },

    add: function (id, colorIndex, size) {
      var existing = null;
      for (var i = 0; i < this.lines.length; i++) {
        var l = this.lines[i];
        if (l.id === id && l.color === colorIndex && l.size === size) { existing = l; break; }
      }
      if (existing) existing.qty += 1;
      else this.lines.push({ id: id, color: colorIndex, size: size, qty: 1 });
      writeBag(this.lines);
      this.paint();
    },

    bump: function (index, delta) {
      var line = this.lines[index];
      if (!line) return;
      line.qty += delta;
      if (line.qty < 1) this.lines.splice(index, 1);
      writeBag(this.lines);
      this.paint();
    },

    remove: function (index) {
      this.lines.splice(index, 1);
      writeBag(this.lines);
      this.paint();
    },

    paint: function () {
      var n = this.count();
      $$("[data-bag-count]").forEach(function (el) {
        el.textContent = n;
        el.setAttribute("data-empty", n === 0 ? "true" : "false");
      });
      $$("[data-bag-label]").forEach(function (el) {
        el.textContent = n === 1 ? "1 item in your bag" : n + " items in your bag";
      });

      var body = $("[data-bag-body]");
      if (!body) return;

      if (!this.lines.length) {
        body.innerHTML =
          '<div class="empty-state">' +
            '<p><strong>Your bag is empty.</strong></p>' +
            '<p class="tiny" style="margin-top:.5rem">Have a look at the ' +
            '<a href="shop.html">new season</a>.</p>' +
          '</div>';
      } else {
        body.innerHTML = this.lines.map(function (l, i) {
          var p = byId(l.id);
          if (!p) return "";
          var c = p.colors[l.color] || p.colors[0];
          return '' +
            '<div class="bag-line">' +
              '<div class="bag-line__art" style="--tint:' + c.tint + '">' + garment(p, l.color) + '</div>' +
              '<div>' +
                '<h3>' + esc(p.name) + '</h3>' +
                '<p>' + esc(c.name) + ' &middot; Size ' + esc(l.size) + '</p>' +
                '<div class="bag-line__foot">' +
                  '<span class="qty">' +
                    '<button type="button" data-bag-dec="' + i + '" aria-label="One fewer ' + esc(p.name) + '">&minus;</button>' +
                    '<span>' + l.qty + '</span>' +
                    '<button type="button" data-bag-inc="' + i + '" aria-label="One more ' + esc(p.name) + '">+</button>' +
                  '</span>' +
                  '<button type="button" class="text-btn" data-bag-del="' + i + '">Remove</button>' +
                  '<span class="bag-line__price">' + money(p.price * l.qty) + '</span>' +
                '</div>' +
              '</div>' +
            '</div>';
        }).join("");
      }

      var totalEl = $("[data-bag-total]");
      if (totalEl) totalEl.textContent = money(this.total());

      var checkout = $("[data-checkout]");
      if (checkout) checkout.setAttribute("aria-disabled", this.lines.length ? "false" : "true");
    }
  };

  function initBag() {
    bag.load();

    var drawer = $(".drawer");
    var scrim = $(".scrim");
    if (!drawer || !scrim) return;
    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      drawer.setAttribute("data-open", "true");
      scrim.setAttribute("data-open", "true");
      drawer.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
      var closeBtn = $(".drawer .close-btn");
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      drawer.setAttribute("data-open", "false");
      scrim.setAttribute("data-open", "false");
      drawer.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    window.KA_openBag = open;

    $$("[data-open-bag]").forEach(function (b) { b.addEventListener("click", open); });
    $$("[data-close-bag]").forEach(function (b) { b.addEventListener("click", close); });
    scrim.addEventListener("click", close);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.getAttribute("data-open") === "true") close();
    });

    drawer.addEventListener("click", function (e) {
      var t = e.target.closest ? e.target.closest("button") : null;
      if (!t) return;
      if (t.hasAttribute("data-bag-inc")) bag.bump(+t.getAttribute("data-bag-inc"), 1);
      else if (t.hasAttribute("data-bag-dec")) bag.bump(+t.getAttribute("data-bag-dec"), -1);
      else if (t.hasAttribute("data-bag-del")) bag.remove(+t.getAttribute("data-bag-del"));
      else if (t.hasAttribute("data-checkout")) {
        if (t.getAttribute("aria-disabled") === "true") toast("Add something first.");
        else toast("Demo site — there is no real checkout.");
      }
    });
  }

  /* ----------------------------------------------------------- product card */

  function cardHTML(p) {
    var c = p.colors[0];
    var cat = "";
    for (var i = 0; i < KA.CATEGORIES.length; i++) {
      if (KA.CATEGORIES[i].id === p.category) cat = KA.CATEGORIES[i].label;
    }
    var flag = "";
    if (p.badge === "new") flag = '<span class="card__flag" data-kind="new">New in</span>';
    else if (p.badge === "few") flag = '<span class="card__flag" data-kind="few">Few left</span>';

    return '' +
      '<a class="card reveal" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
        '<div class="card__frame" style="--tint:' + c.tint + '">' +
          flag + garment(p, 0, "card__garment") +
        '</div>' +
        '<div class="card__body">' +
          '<span class="card__name">' + esc(p.name) + '</span>' +
          '<span class="card__price">' + money(p.price) + '</span>' +
        '</div>' +
        '<div class="card__meta">' + esc(cat) + '</div>' +
        '<div class="card__swatches">' +
          p.colors.map(function (col) {
            return '<span class="swatch-dot" style="background:' + col.main + '" title="' + esc(col.name) + '"></span>';
          }).join("") +
        '</div>' +
      '</a>';
  }

  function initFeatured() {
    $$("[data-featured]").forEach(function (host) {
      var ids = host.getAttribute("data-featured").split(",").map(function (s) { return s.trim(); });
      host.innerHTML = ids.map(byId).filter(Boolean).map(cardHTML).join("");
      watchReveals(host);
    });
  }

  /* ------------------------------------------------------------------- shop */

  function initShop() {
    var grid = $("[data-shop-grid]");
    if (!grid) return;

    var state = { cats: [], ages: [], sort: "featured" };

    var preCat = param("category");
    var preAge = param("age");
    if (preCat) state.cats = [preCat];
    if (preAge) state.ages = [preAge];

    /* Build the filter panels from the data so they cannot drift out of sync. */
    var catBox = $("[data-filter-cats]");
    if (catBox) {
      catBox.innerHTML = KA.CATEGORIES.map(function (c) {
        var n = KA.PRODUCTS.filter(function (p) { return p.category === c.id; }).length;
        return '<label class="check"><input type="checkbox" value="' + c.id + '"' +
          (state.cats.indexOf(c.id) > -1 ? " checked" : "") + '> ' + esc(c.label) +
          '<span class="count">' + n + '</span></label>';
      }).join("");
    }

    var ageBox = $("[data-filter-ages]");
    if (ageBox) {
      ageBox.innerHTML = KA.AGES.map(function (a) {
        var n = KA.PRODUCTS.filter(function (p) { return p.ages.indexOf(a.id) > -1; }).length;
        return '<label class="check"><input type="checkbox" value="' + a.id + '"' +
          (state.ages.indexOf(a.id) > -1 ? " checked" : "") + '> ' + esc(a.label + " (" + a.note + ")") +
          '<span class="count">' + n + '</span></label>';
      }).join("");
    }

    function matches(p) {
      if (state.cats.length && state.cats.indexOf(p.category) === -1) return false;
      if (state.ages.length) {
        var hit = false;
        for (var i = 0; i < state.ages.length; i++) {
          if (p.ages.indexOf(state.ages[i]) > -1) { hit = true; break; }
        }
        if (!hit) return false;
      }
      return true;
    }

    function render() {
      var list = KA.PRODUCTS.filter(matches);

      if (state.sort === "low") list.sort(function (a, b) { return a.price - b.price; });
      else if (state.sort === "high") list.sort(function (a, b) { return b.price - a.price; });
      else if (state.sort === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name); });

      grid.innerHTML = list.length
        ? list.map(cardHTML).join("")
        : '<div class="empty-state"><p><strong>Nothing matches that combination.</strong></p>' +
          '<p class="tiny" style="margin-top:.5rem">Try clearing a filter.</p></div>';

      var countEl = $("[data-shop-count]");
      if (countEl) {
        countEl.textContent = list.length === 1 ? "1 piece" : list.length + " pieces";
      }
      watchReveals(grid);
    }

    function collect() {
      state.cats = $$("[data-filter-cats] input:checked").map(function (i) { return i.value; });
      state.ages = $$("[data-filter-ages] input:checked").map(function (i) { return i.value; });
      render();
    }

    $$("[data-filter-cats], [data-filter-ages]").forEach(function (box) {
      box.addEventListener("change", collect);
    });

    var sortEl = $("[data-sort]");
    if (sortEl) {
      sortEl.addEventListener("change", function () { state.sort = sortEl.value; render(); });
    }

    var clearEl = $("[data-clear-filters]");
    if (clearEl) {
      clearEl.addEventListener("click", function () {
        $$('.filters input[type="checkbox"]').forEach(function (i) { i.checked = false; });
        collect();
      });
    }

    render();
  }

  /* ---------------------------------------------------------------- product */

  function initProduct() {
    var root = $("[data-pdp]");
    if (!root) return;

    var p = byId(param("id") || "") || KA.PRODUCTS[0];
    var colorIndex = 0;
    var size = null;

    var cat = "";
    for (var i = 0; i < KA.CATEGORIES.length; i++) {
      if (KA.CATEGORIES[i].id === p.category) cat = KA.CATEGORIES[i].label;
    }

    document.title = p.name + " — Kiera Anderson";
    var crumb = $("[data-crumb]");
    if (crumb) crumb.textContent = p.name;

    function paint() {
      var c = p.colors[colorIndex];

      $("[data-pdp-stage]").innerHTML = garment(p, colorIndex);
      $("[data-pdp-stage]").style.setProperty("--tint", c.tint);

      $("[data-pdp-thumbs]").innerHTML = p.colors.map(function (col, i) {
        return '<button type="button" class="pdp__thumb" style="--tint:' + col.tint + '" ' +
          'data-thumb="' + i + '" aria-pressed="' + (i === colorIndex) + '" ' +
          'aria-label="Show ' + esc(col.name) + '">' + garment(p, i) + '</button>';
      }).join("");

      $("[data-pdp-colorname]").textContent = c.name;

      $("[data-pdp-colors]").innerHTML = p.colors.map(function (col, i) {
        return '<button type="button" class="color-btn" data-color="' + i + '" ' +
          'aria-pressed="' + (i === colorIndex) + '" aria-label="' + esc(col.name) + '">' +
          '<i style="background:' + col.main + '"></i></button>';
      }).join("");

      $("[data-pdp-sizes]").innerHTML = p.sizes.map(function (s) {
        var out = p.soldOut.indexOf(s) > -1;
        return '<button type="button" class="size-btn" data-size="' + esc(s) + '"' +
          (out ? " disabled" : "") + ' aria-pressed="' + (s === size) + '" ' +
          'title="' + (out ? "Sold out" : "Size " + esc(s)) + '">' + esc(s) + '</button>';
      }).join("");
    }

    $("[data-pdp-name]").textContent = p.name;
    $("[data-pdp-price]").textContent = money(p.price);
    $("[data-pdp-blurb]").textContent = p.blurb;
    $("[data-pdp-cat]").textContent = cat;
    $("[data-pdp-story]").textContent = p.story;
    $("[data-pdp-fabric]").textContent = p.fabric;
    $("[data-pdp-care]").textContent = p.care;
    $("[data-pdp-details]").innerHTML = p.details.map(function (d) {
      return "<li>" + esc(d) + "</li>";
    }).join("");
    $("[data-pdp-ages]").textContent = p.ages.map(function (id) {
      for (var i = 0; i < KA.AGES.length; i++) {
        if (KA.AGES[i].id === id) return KA.AGES[i].label + " (" + KA.AGES[i].note + ")";
      }
      return id;
    }).join(", ");

    paint();

    root.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;

      if (btn.hasAttribute("data-color")) { colorIndex = +btn.getAttribute("data-color"); paint(); }
      else if (btn.hasAttribute("data-thumb")) { colorIndex = +btn.getAttribute("data-thumb"); paint(); }
      else if (btn.hasAttribute("data-size")) { size = btn.getAttribute("data-size"); paint(); }
      else if (btn.hasAttribute("data-add")) {
        if (!size) { toast("Pick a size first."); return; }
        bag.add(p.id, colorIndex, size);
        toast(p.name + " (" + size + ") added to your bag.");
        if (window.KA_openBag) window.KA_openBag();
      }
    });

    /* "Goes well with" — three other pieces, preferring a different category. */
    var alsoHost = $("[data-pdp-also]");
    if (alsoHost) {
      var others = KA.PRODUCTS.filter(function (o) { return o.id !== p.id; });
      others.sort(function (a, b) {
        return (a.category === p.category ? 1 : 0) - (b.category === p.category ? 1 : 0);
      });
      alsoHost.innerHTML = others.slice(0, 4).map(cardHTML).join("");
      watchReveals(alsoHost);
    }
  }

  /* --------------------------------------------------------------- reviews */

  function initReviews() {
    var host = $("[data-reviews]");
    if (!host || !KA.REVIEWS) return;
    var star = '<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">' +
      '<path d="M10 1.6l2.5 5.3 5.8.8-4.2 4 1 5.7L10 14.7 4.9 17.4l1-5.7-4.2-4 5.8-.8z"/></svg>';
    host.innerHTML = KA.REVIEWS.map(function (r) {
      var stars = "";
      for (var i = 0; i < r.stars; i++) stars += star;
      return '<figure class="quote reveal">' +
        '<div class="stars" role="img" aria-label="' + r.stars + ' out of 5">' + stars + '</div>' +
        '<blockquote style="margin:0"><p>&ldquo;' + esc(r.quote) + '&rdquo;</p></blockquote>' +
        '<figcaption class="tiny">' + esc(r.who) + ', ' + esc(r.where) + '</figcaption>' +
        '</figure>';
    }).join("");
    watchReveals(host);
  }

  /* ---------------------------------------------------------------- reveals */

  var observer = null;
  function watchReveals(root) {
    var items = $$(".reveal:not(.is-in)", root || document);
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    }
    items.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i, 6) * 55 + "ms";
      observer.observe(el);
    });
  }

  /* ------------------------------------------------------------ demo forms */

  function initDemoForms() {
    $$("[data-demo-form]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        toast(form.getAttribute("data-demo-form") || "Demo site — nothing was sent.");
        form.reset();
      });
    });
  }

  /* ------------------------------------------------------------------- boot */

  function boot() {
    initNav();
    initBag();
    initFeatured();
    initReviews();
    initShop();
    initProduct();
    initDemoForms();
    watchReveals(document);

    var year = $("[data-year]");
    if (year) year.textContent = new Date().getFullYear();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
