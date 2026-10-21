(() => {
  'use strict';

  function initChaos() {
    const desk = document.querySelector('#brain-desk');
    const organize = document.querySelector('#organize-brain');
    const message = document.querySelector('#brain-message');
    const cards = desk ? [...desk.querySelectorAll('.brain-window')] : [];
    const offsets = new WeakMap();
    let activeDrag = null;
    let nextLayer = 5;

    function setOrganized(organized) {
      if (!desk || !organize) return;
      finishDrag();
      cards.forEach((card) => {
        ['translate', 'transform', 'left', 'top', 'z-index'].forEach((property) => {
          card.style.removeProperty(property);
        });
        card.classList.remove('dragging');
        offsets.delete(card);
      });
      nextLayer = 5;
      desk.classList.toggle('organized', organized);
      if (organized) document.dispatchEvent(new CustomEvent('edgefocus:retro-organize'));
      organize.textContent = organized ? 'MAKE A MESS AGAIN' : 'UNSCRAMBLE MY BRAIN';
      organize.setAttribute('aria-pressed', String(organized));
      if (message) {
        message.textContent = organized
          ? '4 thoughts. One place. That feels better.'
          : 'Click a window. Drag a thought. Make yourself at home.';
      }
    }

    // Individual translate leaves each window's deliberately wonky rotation intact.
    function moveCard(card, dx, dy, origin = null) {
      const bounds = desk.getBoundingClientRect();
      const box = origin?.box || card.getBoundingClientRect();
      const offset = origin?.offset || offsets.get(card) || { x: 0, y: 0 };
      const minX = bounds.left + desk.clientLeft - box.left;
      const maxX = bounds.left + desk.clientLeft + desk.clientWidth - box.right;
      const minY = bounds.top + desk.clientTop - box.top;
      const maxY = bounds.top + desk.clientTop + desk.clientHeight - box.bottom;
      const clamp = (value, min, max) => min > max ? min : Math.min(max, Math.max(min, value));
      const x = offset.x + clamp(dx, minX, maxX);
      const y = offset.y + clamp(dy, minY, maxY);
      offsets.set(card, { x, y });
      card.style.translate = `${x}px ${y}px`;
    }

    function finishDrag(event) {
      if (!activeDrag || (event && event.pointerId !== activeDrag.pointerId)) return;
      const { card, handle, pointerId } = activeDrag;
      activeDrag = null;
      card.classList.remove('dragging');
      card.style.removeProperty('transition');
      if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
    }

    if (desk && organize) {
      organize.addEventListener('click', () => setOrganized(!desk.classList.contains('organized')));
      cards.forEach((card) => {
        const handle = card.querySelector('.drag-handle');
        if (!handle) return;
        offsets.set(card, { x: 0, y: 0 });
        handle.style.touchAction = 'none';
        handle.style.cursor = 'grab';
        if (!handle.hasAttribute('tabindex')) handle.tabIndex = 0;
        handle.title = 'Drag this thought, or use the arrow keys when focused.';

        const isInnerControl = (target) => {
          const control = target.closest('a, button, input, select, textarea, [contenteditable="true"]');
          return Boolean(control && control !== handle);
        };

        handle.addEventListener('pointerdown', (event) => {
          if (event.button !== 0 || !event.isPrimary || isInnerControl(event.target)) return;
          finishDrag();
          const box = card.getBoundingClientRect();
          activeDrag = {
            card, handle, pointerId: event.pointerId,
            startX: event.clientX, startY: event.clientY,
            box, offset: offsets.get(card) || { x: 0, y: 0 }
          };
          card.style.zIndex = String(++nextLayer);
          card.style.transition = 'none';
          card.classList.add('dragging');
          handle.setPointerCapture(event.pointerId);
          handle.focus({ preventScroll: true });
          event.preventDefault();
        });

        handle.addEventListener('pointermove', (event) => {
          if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
          moveCard(activeDrag.card, event.clientX - activeDrag.startX, event.clientY - activeDrag.startY, activeDrag);
        });
        handle.addEventListener('pointerup', finishDrag);
        handle.addEventListener('pointercancel', finishDrag);
        handle.addEventListener('lostpointercapture', finishDrag);
        handle.addEventListener('keydown', (event) => {
          if (isInnerControl(event.target)) return;
          const step = event.shiftKey ? 24 : 8;
          const directions = {
            ArrowLeft: [-step, 0], ArrowRight: [step, 0],
            ArrowUp: [0, -step], ArrowDown: [0, step]
          };
          if (!directions[event.key]) return;
          event.preventDefault();
          card.style.zIndex = String(++nextLayer);
          moveCard(card, ...directions[event.key]);
        });
      });
      window.addEventListener('blur', () => finishDrag());
      setOrganized(desk.classList.contains('organized'));
    }

    const motionToggle = document.querySelector('#motion-toggle');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const sparkLayer = document.querySelector('#cursor-sparks');
    let motionPaused = reducedMotion.matches;
    let lastSparkTime = 0;
    let lastSparkPoint = null;
    let sparkCount = 0;

    function clearSparks() {
      if (!sparkLayer) return;
      [...sparkLayer.children].forEach((spark) => {
        spark.getAnimations().forEach((animation) => animation.cancel());
        spark.remove();
      });
    }

    function setMotionPaused(paused) {
      motionPaused = paused;
      document.body.classList.toggle('motion-paused', paused);
      if (motionToggle) {
        motionToggle.setAttribute('aria-pressed', String(paused));
        motionToggle.textContent = paused ? 'Motion: off' : 'Motion: on';
      }
      if (paused) clearSparks();
    }

    motionToggle?.addEventListener('click', () => setMotionPaused(!motionPaused));
    reducedMotion.addEventListener('change', (event) => setMotionPaused(event.matches));
    setMotionPaused(motionPaused);

    if (sparkLayer && typeof Element.prototype.animate === 'function') {
      sparkLayer.setAttribute('aria-hidden', 'true');
      Object.assign(sparkLayer.style, {
        position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '9999', overflow: 'hidden'
      });
      document.addEventListener('pointermove', (event) => {
        if (motionPaused || reducedMotion.matches || !finePointer.matches || event.pointerType === 'touch') return;
        const now = performance.now();
        if (now - lastSparkTime < 65) return;
        if (lastSparkPoint && Math.hypot(event.clientX - lastSparkPoint.x, event.clientY - lastSparkPoint.y) < 12) return;
        lastSparkTime = now;
        lastSparkPoint = { x: event.clientX, y: event.clientY };
        while (sparkLayer.children.length >= 12) {
          const oldest = sparkLayer.firstElementChild;
          oldest.getAnimations().forEach((animation) => animation.cancel());
          oldest.remove();
        }
        const spark = document.createElement('span');
        spark.className = 'cursor-spark';
        spark.textContent = '✦';
        Object.assign(spark.style, {
          position: 'absolute', left: `${event.clientX + 6}px`, top: `${event.clientY + 6}px`,
          color: ['#fbff00', '#ff76e8', '#50ffff'][sparkCount++ % 3],
          fontSize: '17px', lineHeight: '1', textShadow: '1px 1px #000', pointerEvents: 'none'
        });
        sparkLayer.append(spark);
        const animation = spark.animate([
          { opacity: 0.85, transform: 'translate(0, 0) scale(1) rotate(0deg)' },
          { opacity: 0, transform: 'translate(-6px, 20px) scale(.25) rotate(50deg)' }
        ], { duration: 650, easing: 'ease-out', fill: 'forwards' });
        animation.onfinish = () => spark.remove();
      }, { passive: true });
      document.addEventListener('visibilitychange', () => { if (document.hidden) clearSparks(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initChaos, { once: true });
  } else {
    initChaos();
  }
})();
