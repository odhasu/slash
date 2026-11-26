(() => {
  const enabled = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  const duration = 145;
  let frame = 0;
  let start = 0;
  let target = 0;
  let position = 0;
  let timestamp = 0;

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
  }

  function animate(now) {
    const progress = Math.min(1, (now - timestamp) / duration);
    window.scrollTo({ top: start + (target - start) * (1 - (1 - progress) ** 3), behavior: "instant" });
    position = window.scrollY;
    frame = progress < 1 ? requestAnimationFrame(animate) : 0;
  }

  function usesNativeScroll(event) {
    for (const node of event.composedPath()) {
      if (node === document.body || node === document.documentElement) break;
      if (!(node instanceof Element)) continue;
      const { overflowX, overflowY } = getComputedStyle(node);
      if ((/auto|scroll/.test(overflowX) && node.scrollWidth > node.clientWidth) ||
          (/auto|scroll/.test(overflowY) && node.scrollHeight > node.clientHeight)) return true;
    }
    return getComputedStyle(document.documentElement).overflowY === "hidden";
  }

  window.addEventListener("wheel", (event) => {
    const { deltaMode, deltaX, deltaY } = event;
    // Leave small, high-resolution trackpad gestures and horizontal wheels with the browser.
    if (!enabled.matches || !event.cancelable || event.defaultPrevented ||
        event.ctrlKey || event.shiftKey || event.metaKey || deltaX ||
        Math.abs(deltaY) < (deltaMode === 0 ? 48 : 1) || usesNativeScroll(event)) {
      stop();
      return;
    }

    const current = window.scrollY;
    const distance = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? window.innerHeight : 1);
    const maximum = Math.max(0, document.scrollingElement.scrollHeight - window.innerHeight);
    const sameDirection = frame && Math.abs(current - position) < 2 && Math.sign(target - current) === Math.sign(distance);
    const next = Math.min(maximum, Math.max(0, (sameDirection ? target : current) + distance));
    if (next === current) {
      stop();
      return;
    }

    event.preventDefault();
    start = position = current;
    target = next;
    timestamp = performance.now();
    if (!frame) frame = requestAnimationFrame(animate);
  }, { passive: false });

  window.addEventListener("keydown", stop, { passive: true });
  window.addEventListener("pointerdown", stop, { passive: true });
  window.addEventListener("scroll", () => {
    if (frame && Math.abs(window.scrollY - position) > 2) stop();
  }, { passive: true });
  enabled.addEventListener("change", stop);
})();
