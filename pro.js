/* =========================================================
   Brew House: script.js (vanilla JavaScript, no dependencies)
   Sections: Config, Products, Helpers, Images, Menu, Cart,
             Navigation, Newsletter, Init
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Config: edit these to customize ---------- */
  const CONFIG = {
    currency: 'USD',
    locale: 'en-US',
    mapUrl: 'https://www.openstreetmap.org/', // "Get Directions" destination
    storageKey: 'brewhouse-cart-v1',
    maxQty: 20,
    scrolledAfter: 24, // px scrolled before the header gets its background
  };

  /* ---------- Products: the single source of truth ---------- */
  const photo = (id, w, h) =>
    `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;

  // categories: 'hot' and/or 'iced'. A drink in both appears under both filters.
  const PRODUCTS = [
    { id: 'signature-espresso', name: 'Signature Espresso', priceCents: 300, categories: ['hot'], temperature: 'Hot',
      description: 'A concentrated double shot with dark cocoa, toasted almond, and a thick, caramel-colored crema.',
      imageId: '1510707577719-ae7c14805e3a' },
    { id: 'velvet-cappuccino', name: 'Velvet Cappuccino', priceCents: 425, categories: ['hot'], temperature: 'Hot',
      description: 'Equal parts espresso and silky steamed milk under a dense, cloud-soft foam.',
      imageId: '1572442388796-11668a67e53d' },
    { id: 'vanilla-oat-latte', name: 'Vanilla Oat Latte', priceCents: 500, categories: ['hot', 'iced'], temperature: 'Hot or iced',
      description: 'Espresso and creamy oat milk, lightly sweetened with real vanilla bean syrup.',
      imageId: '1561882468-9110e03e0f78' },
    { id: 'caramel-cold-brew', name: 'Caramel Cold Brew', priceCents: 475, categories: ['iced'], temperature: 'Iced',
      description: 'Steeped slowly for 18 hours, poured over ice, and finished with house-made caramel.',
      imageId: '1517701604599-bb29b565090c' },
    { id: 'spanish-latte', name: 'Spanish Latte', priceCents: 525, categories: ['hot', 'iced'], temperature: 'Hot or iced',
      description: 'Espresso and milk sweetened with condensed milk for a rich, round, dessert-like cup.',
      imageId: '1485808191679-5f86510681a2' },
    { id: 'classic-flat-white', name: 'Classic Flat White', priceCents: 400, categories: ['hot'], temperature: 'Hot',
      description: 'A double ristretto with finely textured milk. Small, strong, and perfectly smooth.',
      imageId: '1577968897966-3d4325b36b61' },
  ];
  const PRODUCT_BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));

  /* ---------- Helpers ---------- */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const money = new Intl.NumberFormat(CONFIG.locale, { style: 'currency', currency: CONFIG.currency });
  const formatPrice = (cents) => money.format(cents / 100);
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Tiny DOM builder: h('button', { class: 'btn', onclick: fn }, 'Label') */
  function h(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') node.className = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    node.append(...children.flat().filter((c) => c != null && c !== false));
    return node;
  }

  /** Screen-reader announcements */
  const liveRegion = $('#live');
  function announce(message) {
    if (!liveRegion) return;
    liveRegion.textContent = '';
    window.setTimeout(() => { liveRegion.textContent = message; }, 50);
  }

  /** Keep Tab focus inside a dialog while it is open */
  function trapFocus(event, container) {
    if (event.key !== 'Tab') return;
    const focusable = $$('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])', container)
      .filter((el) => el.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  /* ---------- Images: graceful fallback ---------- */
  const Images = {
    markFallback(img) {
      const frame = img.closest('.img-frame');
      if (frame) frame.classList.add('is-fallback');
    },
    init() {
      // 'error' does not bubble, so listen in the capture phase.
      document.addEventListener('error', (event) => {
        if (event.target instanceof HTMLImageElement) Images.markFallback(event.target);
      }, true);
      Images.check();
    },
    // Catch images that already failed before this script ran.
    check() {
      $$('img').forEach((img) => {
        if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) Images.markFallback(img);
      });
    },
  };

  /* ---------- Menu: render + filters ---------- */
  const Menu = {
    grid: $('#menu-grid'),
    status: $('#filter-status'),

    createCard(product) {
      const src = (w, h) => photo(product.imageId, w, h);
      const addBtn = h('button', {
        class: 'btn btn--primary btn--small', type: 'button',
        'aria-label': `Add ${product.name} to order`,
        onclick: () => { Cart.add(product.id); Menu.flashAdded(addBtn); },
      }, 'Add to Order');

      return h('article', { class: 'card', 'data-id': product.id, 'data-categories': product.categories.join(' ') },
        h('div', { class: 'card__media img-frame', 'data-fallback': product.name },
          h('img', {
            src: src(640, 480), srcset: `${src(480, 360)} 480w, ${src(800, 600)} 800w`,
            sizes: '(min-width: 1025px) 360px, (min-width: 600px) 45vw, 100vw',
            width: 640, height: 480, loading: 'lazy', decoding: 'async', alt: `${product.name} served in a cup`,
          })),
        h('div', { class: 'card__body' },
          h('p', { class: 'card__tag' }, product.temperature),
          h('h3', { class: 'card__title' }, product.name),
          h('p', { class: 'card__desc' }, product.description),
          h('div', { class: 'card__foot' },
            h('span', { class: 'card__price' }, formatPrice(product.priceCents)),
            addBtn)));
    },

    flashAdded(button) {
      button.textContent = 'Added';
      button.classList.add('is-added');
      window.setTimeout(() => {
        button.textContent = 'Add to Order';
        button.classList.remove('is-added');
      }, 1200);
    },

    applyFilter(filter) {
      let visible = 0;
      $$('.card', Menu.grid).forEach((card) => {
        const show = filter === 'all' || card.dataset.categories.split(' ').includes(filter);
        card.hidden = !show;
        if (show) visible += 1;
      });
      $$('.filter').forEach((btn) => btn.setAttribute('aria-pressed', String(btn.dataset.filter === filter)));
      if (Menu.status) Menu.status.textContent = `Showing ${visible} ${visible === 1 ? 'drink' : 'drinks'}`;
    },

    init() {
      if (!Menu.grid) return;
      Menu.grid.append(...PRODUCTS.map(Menu.createCard));
      $$('.filter').forEach((btn) => btn.addEventListener('click', () => Menu.applyFilter(btn.dataset.filter)));
      Images.check();
    },
  };

  /* ---------- Cart: state, storage, rendering, drawer ---------- */
  const Cart = {
    items: [], // [{ id, qty }]
    drawer: $('#cart-drawer'),
    overlay: $('#overlay'),
    list: $('#cart-list'),
    empty: $('#cart-empty'),
    totalEl: $('#cart-total'),
    badge: $('#cart-count'),
    badgeSr: $('#cart-count-sr'),
    openBtn: $('#cart-open'),
    closeBtn: $('#cart-close'),
    clearBtn: $('#cart-clear'),
    lastFocused: null,

    /* Storage (wrapped: localStorage can be unavailable or blocked) */
    load() {
      try {
        const raw = JSON.parse(window.localStorage.getItem(CONFIG.storageKey) || '[]');
        if (!Array.isArray(raw)) return [];
        return raw
          .filter((i) => i && PRODUCT_BY_ID.has(i.id) && Number.isInteger(i.qty) && i.qty > 0)
          .map((i) => ({ id: i.id, qty: Math.min(i.qty, CONFIG.maxQty) }));
      } catch { return []; }
    },
    save() {
      try { window.localStorage.setItem(CONFIG.storageKey, JSON.stringify(Cart.items)); } catch { /* ignore */ }
    },

    /* State changes */
    add(id) {
      const product = PRODUCT_BY_ID.get(id);
      if (!product) return;
      const line = Cart.items.find((i) => i.id === id);
      if (line) {
        if (line.qty >= CONFIG.maxQty) { announce(`Maximum of ${CONFIG.maxQty} ${product.name} per order.`); return; }
        line.qty += 1;
      } else { Cart.items.push({ id, qty: 1 }); }
      Cart.commit();
      announce(`Added ${product.name} to your order. ${Cart.count()} items, total ${formatPrice(Cart.total())}.`);
    },
    setQty(id, qty, focusKey) {
      const line = Cart.items.find((i) => i.id === id);
      if (!line) return;
      line.qty = Math.max(1, Math.min(CONFIG.maxQty, qty));
      Cart.commit(focusKey);
    },
    remove(id) {
      const product = PRODUCT_BY_ID.get(id);
      Cart.items = Cart.items.filter((i) => i.id !== id);
      Cart.commit('after-remove');
      announce(`Removed ${product.name} from your order.`);
    },
    clear() {
      Cart.items = [];
      Cart.commit('after-remove');
      announce('Order cleared.');
    },
    commit(focusKey) { Cart.save(); Cart.render(focusKey); },

    /* Derived values */
    count: () => Cart.items.reduce((sum, i) => sum + i.qty, 0),
    total: () => Cart.items.reduce((sum, i) => sum + PRODUCT_BY_ID.get(i.id).priceCents * i.qty, 0),

    /* Rendering */
    row(item) {
      const p = PRODUCT_BY_ID.get(item.id);
      const stepper = (symbol, label, key, disabled, next) => h('button', {
        class: 'qty__btn', type: 'button', 'aria-label': label, 'data-key': `${item.id}:${key}`,
        disabled, onclick: () => Cart.setQty(item.id, next, `${item.id}:${key}`),
      }, symbol);

      return h('li', { class: 'cart-item' },
        h('div', {},
          h('p', { class: 'cart-item__name' }, p.name),
          h('p', { class: 'cart-item__unit' }, `${formatPrice(p.priceCents)} each`)),
        h('p', { class: 'cart-item__line' }, formatPrice(p.priceCents * item.qty)),
        h('div', { class: 'cart-item__controls' },
          h('div', { class: 'qty', role: 'group', 'aria-label': `Quantity of ${p.name}` },
            stepper('\u2212', `Decrease quantity of ${p.name}`, 'dec', item.qty <= 1, item.qty - 1),
            h('span', { class: 'qty__value', 'aria-live': 'polite' }, String(item.qty)),
            stepper('+', `Increase quantity of ${p.name}`, 'inc', item.qty >= CONFIG.maxQty, item.qty + 1)),
          h('button', {
            class: 'link-btn', type: 'button', 'aria-label': `Remove ${p.name} from order`,
            onclick: () => Cart.remove(item.id),
          }, 'Remove')));
    },
    render(focusKey) {
      const count = Cart.count();
      Cart.list.replaceChildren(...Cart.items.map(Cart.row));
      Cart.empty.hidden = count > 0;
      Cart.clearBtn.disabled = count === 0;
      Cart.totalEl.textContent = formatPrice(Cart.total());
      Cart.badge.textContent = String(count);
      Cart.badge.hidden = count === 0;
      Cart.badgeSr.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;

      // Re-rendering replaces the buttons, so put keyboard focus back where it was.
      if (!focusKey) return;
      if (focusKey === 'after-remove') {
        const next = $('.link-btn', Cart.list);
        (next || Cart.closeBtn).focus();
        return;
      }
      const target = $(`[data-key="${focusKey}"]`, Cart.list);
      if (target && !target.disabled) { target.focus(); return; }
      const sibling = $(`[data-key="${focusKey.split(':')[0]}:${focusKey.endsWith('dec') ? 'inc' : 'dec'}"]`, Cart.list);
      (sibling && !sibling.disabled ? sibling : Cart.closeBtn).focus();
    },

    /* Drawer open / close */
    open() {
      if (Cart.drawer.classList.contains('is-open')) return;
      Cart.lastFocused = document.activeElement;
      Nav.close(false);
      Cart.drawer.inert = false;
      Cart.drawer.setAttribute('aria-hidden', 'false');
      Cart.drawer.classList.add('is-open');
      Cart.overlay.classList.add('is-visible');
      document.body.classList.add('is-locked');
      Cart.openBtn.setAttribute('aria-expanded', 'true');
      Cart.closeBtn.focus();
    },
    close() {
      if (!Cart.drawer.classList.contains('is-open')) return;
      Cart.drawer.classList.remove('is-open');
      Cart.overlay.classList.remove('is-visible');
      Cart.drawer.setAttribute('aria-hidden', 'true');
      Cart.drawer.inert = true;
      document.body.classList.remove('is-locked');
      Cart.openBtn.setAttribute('aria-expanded', 'false');
      if (Cart.lastFocused && document.contains(Cart.lastFocused)) Cart.lastFocused.focus();
      else Cart.openBtn.focus();
    },

    init() {
      Cart.items = Cart.load();
      Cart.render();
      Cart.openBtn.addEventListener('click', Cart.open);
      Cart.closeBtn.addEventListener('click', Cart.close);
      $('#cart-continue').addEventListener('click', Cart.close);
      Cart.clearBtn.addEventListener('click', Cart.clear);
      Cart.overlay.addEventListener('click', Cart.close);
      Cart.drawer.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); Cart.close(); }
        else trapFocus(e, Cart.drawer);
      });
      // Keep several open tabs in sync
      window.addEventListener('storage', (e) => {
        if (e.key === CONFIG.storageKey) { Cart.items = Cart.load(); Cart.render(); }
      });
    },
  };

  /* ---------- Navigation: mobile menu, scroll state, smooth scroll ---------- */
  const Nav = {
    header: $('#site-header'),
    toggle: $('#menu-toggle'),
    panel: $('#primary-nav'),
    desktop: window.matchMedia('(min-width: 960px)'),

    isOpen: () => Nav.toggle.getAttribute('aria-expanded') === 'true',
    open() {
      Nav.toggle.setAttribute('aria-expanded', 'true');
      Nav.toggle.setAttribute('aria-label', 'Close menu');
      Nav.panel.classList.add('is-open');
      Nav.header.classList.add('is-menu-open');
    },
    close(returnFocus = true) {
      if (!Nav.isOpen()) return;
      Nav.toggle.setAttribute('aria-expanded', 'false');
      Nav.toggle.setAttribute('aria-label', 'Open menu');
      Nav.panel.classList.remove('is-open');
      Nav.header.classList.remove('is-menu-open');
      if (returnFocus) Nav.toggle.focus();
    },
    updateScrolled() {
      Nav.header.classList.toggle('is-scrolled', window.scrollY > CONFIG.scrolledAfter);
    },
    smoothScrollTo(hash) {
      const target = hash.length > 1 ? document.getElementById(hash.slice(1)) : null;
      if (!target) return false;
      target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      history.pushState(null, '', hash);
      // Move keyboard focus to the section so screen-reader and keyboard users land there too.
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      return true;
    },
    trackActiveSection() {
      if (!('IntersectionObserver' in window)) return;
      const links = new Map($$('.nav__link').map((a) => [a.getAttribute('href').slice(1), a]));
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((a) => a.classList.remove('is-active'));
          const link = links.get(entry.target.id);
          if (link) link.classList.add('is-active');
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      links.forEach((_, id) => { const section = document.getElementById(id); if (section) observer.observe(section); });
    },

    init() {
      Nav.toggle.addEventListener('click', () => (Nav.isOpen() ? Nav.close() : Nav.open()));
      Nav.panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') Nav.close(); });
      Nav.toggle.addEventListener('keydown', (e) => { if (e.key === 'Escape') Nav.close(); });
      Nav.desktop.addEventListener('change', (e) => { if (e.matches) Nav.close(false); });
      document.addEventListener('click', (e) => {
        if (Nav.isOpen() && !Nav.header.contains(e.target)) Nav.close(false);
      });

      // One delegated handler for every in-page link (nav, buttons, footer, skip link)
      document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
        if (Nav.smoothScrollTo(link.getAttribute('href'))) {
          e.preventDefault();
          Nav.close(false); // closes the mobile menu after choosing a link
        }
      });

      window.addEventListener('scroll', Nav.updateScrolled, { passive: true });
      Nav.updateScrolled();
      Nav.trackActiveSection();
    },
  };

  /* ---------- Newsletter: honest, front-end-only validation ---------- */
  const Newsletter = {
    form: $('#newsletter-form'),
    input: $('#newsletter-email'),
    message: $('#newsletter-msg'),
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,

    show(text, isError) {
      Newsletter.message.hidden = false;
      Newsletter.message.textContent = text;
      Newsletter.message.classList.toggle('is-error', isError);
      Newsletter.input.setAttribute('aria-invalid', String(isError));
    },
    init() {
      if (!Newsletter.form) return;
      Newsletter.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const value = Newsletter.input.value.trim();
        if (!value) {
          Newsletter.show('Please enter your email address.', true);
          Newsletter.input.focus();
        } else if (value.length > 254 || !Newsletter.EMAIL.test(value)) {
          Newsletter.show('That email address does not look right. Check it and try again, for example name@example.com.', true);
          Newsletter.input.focus();
        } else {
          Newsletter.show('Thanks! This is a demo form, so no subscription was created and your email address was not stored or sent anywhere.', false);
          Newsletter.form.reset();
        }
      });
      Newsletter.input.addEventListener('input', () => {
        Newsletter.input.removeAttribute('aria-invalid');
        Newsletter.message.hidden = true;
      });
    },
  };

  /* ---------- Init ---------- */
  function init() {
    Images.init();
    Menu.init();
    Cart.init();
    Nav.init();
    Newsletter.init();

    const directions = $('#directions-link');
    if (directions) directions.href = CONFIG.mapUrl;
    const year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
