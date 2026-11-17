// Touch-Anpassungen für Duelingbook auf dem Tablet.
// Wird nach jedem Seitenaufruf eingespielt.
(function () {
  if (window.__dbTouch) return;
  window.__dbTouch = true;

  var NATIVE = window.DBApp || null; // Brücke zur App (Tastatur öffnen/schließen)

  // ---------------------------------------------------------------
  // 0) Grund-CSS
  // ---------------------------------------------------------------
  var css = document.createElement('style');
  css.textContent = [
    '* { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }',
    'body { -webkit-user-select: none; user-select: none; touch-action: manipulation; }',
    'input, textarea, [contenteditable] { -webkit-user-select: text; user-select: text; }',
    '::-webkit-scrollbar { width: 18px; height: 18px; }',
    '::-webkit-scrollbar-thumb { background: rgba(150,150,150,.7); border-radius: 9px; }'
  ].join('\n');
  (document.head || document.documentElement).appendChild(css);

  // ---------------------------------------------------------------
  // 1) Tastatur nur bei direktem Tippen auf ein Eingabefeld
  //
  //    Duelingbook setzt den Fokus oft selbst auf Textfelder (Suche,
  //    Chat, versteckte Felder), z. B. beim Öffnen von Friedhof/Deck
  //    oder beim Angreifen. Auf dem Tablet geht dann jedes Mal die
  //    Tastatur auf. Lösung: Alle Textfelder bekommen inputmode="none"
  //    – sie funktionieren weiter, aber ohne Bildschirmtastatur.
  //    Erst wenn DU direkt auf ein Feld tippst, wird die Tastatur
  //    für dieses Feld freigeschaltet und aktiv geöffnet.
  // ---------------------------------------------------------------
  var TEXT_TYPES = /^(text|search|number|tel|email|password|url|)$/i;

  function isEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.isContentEditable) return true;
    var tag = el.tagName;
    if (tag === 'TEXTAREA') return !el.readOnly && !el.disabled;
    if (tag === 'INPUT') {
      return TEXT_TYPES.test(el.getAttribute('type') || '') && !el.readOnly && !el.disabled;
    }
    return false;
  }

  function editableAt(target) {
    if (!target || !target.closest) return null;
    if (isEditable(target)) return target;
    var lbl = target.closest('label');
    if (lbl && lbl.control && isEditable(lbl.control)) return lbl.control;
    return null;
  }

  function lock(el) {
    if (!isEditable(el) || el.__dbUnlocked) return;
    if (!el.hasAttribute('data-db-im')) {
      el.setAttribute('data-db-im', el.getAttribute('inputmode') || '');
    }
    if (el.getAttribute('inputmode') !== 'none') el.setAttribute('inputmode', 'none');
  }

  function unlock(el) {
    el.__dbUnlocked = true;
    var orig = el.getAttribute('data-db-im');
    var type = (el.getAttribute('type') || '').toLowerCase();
    var mode = orig || (type === 'number' || type === 'tel' ? 'decimal' : 'text');
    el.setAttribute('inputmode', mode);
  }

  function lockAll(root) {
    var list = (root || document).querySelectorAll
      ? (root || document).querySelectorAll('input, textarea, [contenteditable]')
      : [];
    for (var i = 0; i < list.length; i++) lock(list[i]);
  }

  lockAll(document);
  new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var added = muts[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        var n = added[j];
        if (n.nodeType !== 1) continue;
        lock(n);
        lockAll(n);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  // Feld, das gerade per Finger angetippt wird
  var tappedField = null;

  function openKeyboardFor(el) {
    unlock(el);
    // Fokus neu setzen, damit Android den neuen inputmode übernimmt
    if (document.activeElement === el) el.blur();
    setTimeout(function () {
      el.focus({ preventScroll: true });
      try {
        var len = (el.value || '').length;
        if (el.setSelectionRange && /^(text|search|tel|url|password|)$/i.test(el.type || '')) {
          el.setSelectionRange(len, len);
        }
      } catch (e) {}
      if (NATIVE) NATIVE.showKeyboard();
    }, 30);
  }

  // Wenn ein Feld den Fokus verliert, wieder sperren + Tastatur zu
  document.addEventListener('focusout', function (e) {
    var el = e.target;
    if (!isEditable(el)) return;
    setTimeout(function () {
      if (document.activeElement === el) return;
      el.__dbUnlocked = false;
      lock(el);
      if (!isEditable(document.activeElement) && NATIVE) NATIVE.hideKeyboard();
    }, 50);
  }, true);

  // Fokus, den die Seite selbst setzt, öffnet keine Tastatur
  document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (isEditable(el) && !el.__dbUnlocked) lock(el);
  }, true);

  // ---------------------------------------------------------------
  // 2) Langes Drücken = Maus drüberfahren (Kartenvorschau)
  // ---------------------------------------------------------------
  var HOLD_MS = 450;
  var timer = null, startX = 0, startY = 0, startT = 0, hovered = null;
  var held = false, moved = false;

  function fire(el, type, x, y) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent(type, {
      bubbles: type !== 'mouseenter' && type !== 'mouseleave',
      cancelable: true, view: window, clientX: x, clientY: y,
      button: 0, buttons: type === 'mousedown' ? 1 : 0
    }));
  }

  function hoverAt(x, y) {
    var el = document.elementFromPoint(x, y);
    if (el === hovered) { fire(el, 'mousemove', x, y); return; }
    if (hovered) { fire(hovered, 'mouseout', x, y); fire(hovered, 'mouseleave', x, y); }
    hovered = el;
    fire(el, 'mouseover', x, y);
    fire(el, 'mouseenter', x, y);
    fire(el, 'mousemove', x, y);
  }

  // ---------------------------------------------------------------
  // 3) Größere Trefferfläche für kleine Buttons (z. B. das X)
  //
  //    Trifft ein kurzer Tipp nichts Klickbares, wird im Umkreis nach
  //    einem kleinen klickbaren Element gesucht und das angeklickt.
  // ---------------------------------------------------------------
  var ASSIST_RADIUS = 22;   // Suchradius in CSS-Pixeln
  var ASSIST_MAX_SIZE = 48; // nur kleine Elemente (Buttons, nicht Karten)

  function isClickable(el) {
    for (var n = el, d = 0; n && n.nodeType === 1 && d < 4; n = n.parentElement, d++) {
      var tag = n.tagName;
      if (tag === 'BUTTON' || tag === 'A' || tag === 'SELECT' || isEditable(n)) return n;
      if (n.onclick || n.onmousedown || n.onmouseup) return n;
      if (n.getAttribute && n.getAttribute('role') === 'button') return n;
      var cur = getComputedStyle(n).cursor;
      if (cur === 'pointer') return n;
    }
    return null;
  }

  function findNearbyButton(x, y) {
    var best = null, bestDist = 1e9;
    var steps = [8, 14, ASSIST_RADIUS];
    for (var s = 0; s < steps.length; s++) {
      var r = steps[s];
      for (var a = 0; a < 16; a++) {
        var ang = (a / 16) * Math.PI * 2;
        var px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
        var el = document.elementFromPoint(px, py);
        if (!el) continue;
        var c = isClickable(el);
        if (!c || isEditable(c)) continue;
        var rect = c.getBoundingClientRect();
        if (rect.width > ASSIST_MAX_SIZE || rect.height > ASSIST_MAX_SIZE) continue;
        var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
        var dist = Math.hypot(cx - x, cy - y);
        if (dist < bestDist) { bestDist = dist; best = { el: c, x: cx, y: cy }; }
      }
      if (best) return best;
    }
    return null;
  }

  function clickAt(el, x, y) {
    fire(el, 'mouseover', x, y);
    fire(el, 'mousedown', x, y);
    fire(el, 'mouseup', x, y);
    fire(el, 'click', x, y);
  }

  // ---------------------------------------------------------------
  // Touch-Handler
  // ---------------------------------------------------------------
  document.addEventListener('touchstart', function (e) {
    clearTimeout(timer);
    if (e.touches.length !== 1) { held = false; return; }
    var t = e.touches[0];
    startX = t.clientX; startY = t.clientY; startT = Date.now();
    held = false; moved = false;

    tappedField = editableAt(e.target);
    if (tappedField) return; // Eingabefelder: kein Halten/Hover

    timer = setTimeout(function () {
      held = true;
      if (navigator.vibrate) navigator.vibrate(15);
      hoverAt(startX, startY);
    }, HOLD_MS);
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (!t) return;
    if (held) {
      hoverAt(t.clientX, t.clientY); // Vorschau wandert mit dem Finger
    } else if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) {
      moved = true;
      clearTimeout(timer);
    }
  }, { passive: true, capture: true });

  document.addEventListener('touchend', function (e) {
    clearTimeout(timer);

    // Nach langem Drücken: nur Vorschau, kein Klick
    if (held) {
      e.preventDefault();
      e.stopPropagation();
      held = false;
      return;
    }
    if (moved || e.changedTouches.length !== 1) return;

    // Direkter Tipp auf ein Eingabefeld -> Tastatur sicher öffnen
    if (tappedField) {
      var f = tappedField;
      tappedField = null;
      openKeyboardFor(f);
      return;
    }

    // Tipp daneben -> Tastatur schließen, falls offen
    if (isEditable(document.activeElement)) {
      document.activeElement.blur();
    }

    // Kleiner Button knapp verfehlt? -> den nächstgelegenen anklicken
    var t = e.changedTouches[0];
    var under = document.elementFromPoint(t.clientX, t.clientY);
    if (under && !isClickable(under)) {
      var near = findNearbyButton(t.clientX, t.clientY);
      if (near) {
        e.preventDefault(); // Original-Klick ins Leere unterdrücken
        clickAt(near.el, near.x, near.y);
      }
    }
  }, { passive: false, capture: true });

  document.addEventListener('touchcancel', function () {
    clearTimeout(timer);
    held = false;
    tappedField = null;
  }, { passive: true, capture: true });

  // Kontextmenü des Systems beim langen Drücken unterdrücken
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); }, true);

  // ---------------------------------------------------------------
  // 4) S-Pen-Knopf = "Abbrechen": offenes Aktionsmenü schließen
  //
  //    Wird von der App aufgerufen, wenn der Stift mit gedrücktem
  //    Seitenknopf tippt. Schickt Escape und einen Klick auf eine
  //    leere Hintergrundfläche – so schließen sich Auswahlmenüs
  //    (z. B. bei verdeckten Karten), ohne etwas anderes auszulösen.
  // ---------------------------------------------------------------
  function findBackgroundPoint() {
    var w = window.innerWidth, h = window.innerHeight;
    var best = null, bestArea = 0;
    for (var gx = 1; gx <= 9; gx++) {
      for (var gy = 1; gy <= 5; gy++) {
        var x = (w * gx) / 10, y = (h * gy) / 6;
        var el = document.elementFromPoint(x, y);
        if (!el || isClickable(el) || isEditable(el)) continue;
        var r = el.getBoundingClientRect();
        var area = r.width * r.height;
        if (area > bestArea) { bestArea = area; best = { el: el, x: x, y: y }; }
      }
    }
    return best;
  }

  window.__dbPenButton = function () {
    var a = document.activeElement || document.body;
    ['keydown', 'keyup'].forEach(function (type) {
      a.dispatchEvent(new KeyboardEvent(type, {
        key: 'Escape', code: 'Escape', keyCode: 27, which: 27,
        bubbles: true, cancelable: true
      }));
    });
    if (isEditable(document.activeElement)) document.activeElement.blur();

    var bg = findBackgroundPoint();
    if (bg) {
      fire(bg.el, 'mousedown', bg.x, bg.y);
      fire(bg.el, 'mouseup', bg.x, bg.y);
      fire(bg.el, 'click', bg.x, bg.y);
    } else {
      fire(document.body, 'mousedown', 0, 0);
      fire(document.body, 'mouseup', 0, 0);
      fire(document.body, 'click', 0, 0);
    }
  };
})();
