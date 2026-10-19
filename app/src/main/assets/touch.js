// Touch-Anpassungen für Duelingbook auf dem Tablet.
// Wird nach jedem Seitenaufruf eingespielt.
(function () {
  if (window.__dbTouch) return;
  window.__dbTouch = true;

  // 1) Kein Text-Markieren / iOS-artiges Kontextmenü beim Halten,
  //    größere Scrollbalken, kein blauer Tap-Highlight.
  var css = document.createElement('style');
  css.textContent = [
    '* { -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }',
    'body { -webkit-user-select: none; user-select: none; touch-action: manipulation; }',
    'input, textarea, [contenteditable] { -webkit-user-select: text; user-select: text; }',
    '::-webkit-scrollbar { width: 18px; height: 18px; }',
    '::-webkit-scrollbar-thumb { background: rgba(150,150,150,.7); border-radius: 9px; }'
  ].join('\n');
  document.head.appendChild(css);

  // 2) Langes Drücken = Maus drüberfahren (Hover).
  //    Damit erscheint z. B. die Kartenvorschau, ohne dass geklickt wird.
  var HOLD_MS = 350;
  var timer = null, startX = 0, startY = 0, hovered = null, held = false;

  function fire(el, type, x, y) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent(type, {
      bubbles: type !== 'mouseenter' && type !== 'mouseleave',
      cancelable: true, view: window, clientX: x, clientY: y
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

  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { clearTimeout(timer); return; }
    var t = e.touches[0];
    startX = t.clientX; startY = t.clientY; held = false;
    clearTimeout(timer);
    timer = setTimeout(function () {
      held = true;
      if (navigator.vibrate) navigator.vibrate(15);
      hoverAt(startX, startY);
    }, HOLD_MS);
  }, { passive: true, capture: true });

  document.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (held) {
      // Finger halten und über Karten gleiten = Vorschau wandert mit
      hoverAt(t.clientX, t.clientY);
    } else if (Math.abs(t.clientX - startX) > 10 || Math.abs(t.clientY - startY) > 10) {
      clearTimeout(timer);
    }
  }, { passive: true, capture: true });

  document.addEventListener('touchend', function (e) {
    clearTimeout(timer);
    if (held) {
      // Nach dem Halten keinen Klick auslösen – nur Vorschau zeigen
      e.preventDefault();
      e.stopPropagation();
      held = false;
    }
  }, { passive: false, capture: true });

  // Kontextmenü des Systems beim langen Drücken unterdrücken
  document.addEventListener('contextmenu', function (e) { e.preventDefault(); }, true);
})();
