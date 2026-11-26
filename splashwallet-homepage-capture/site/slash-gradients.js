function startGradientMotion() {
  const selector = '[data-swirl], [style*="background-image:linear-gradient"][style*="#c7c7c7"]';
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const precisePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const animations = new Map();
  const visible = new Set();
  const lit = new Set();
  let pointer = null;
  let frame = 0;

  function updateMotion() {
    for (const [board, animation] of animations) {
      if (reducedMotion.matches || document.hidden || !visible.has(board)) {
        animation.pause();
        if (reducedMotion.matches) animation.currentTime = 0;
      } else {
        animation.play();
      }
    }
  }

  const intersection = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target);
      else visible.delete(entry.target);
    }
    updateMotion();
    if (pointer) requestLighting();
  });

  function scan() {
    for (const [board, animation] of animations) {
      if (board.isConnected) continue;
      intersection.unobserve(board);
      animation.cancel();
      animations.delete(board);
      visible.delete(board);
      lit.delete(board);
    }

    for (const board of document.querySelectorAll(selector)) {
      if (animations.has(board)) continue;
      const keyframes = board.hasAttribute("data-swirl")
        ? [{ transform: "none" }, { transform: "translate3d(11px, -9px, 0) scale(1.025)" }]
        : [{ backgroundPosition: "45% 45%" }, { backgroundPosition: "55% 55%" }];
      const animation = board.animate(keyframes, {
        duration: 16000, iterations: Infinity, direction: "alternate", easing: "ease-in-out",
      });
      animation.pause();
      animations.set(board, animation);
      intersection.observe(board);
    }
  }

  function drawLight() {
    frame = 0;
    const next = new Set();
    if (pointer && precisePointer.matches && !reducedMotion.matches && !document.hidden) {
      for (const board of visible) {
        const bounds = board.getBoundingClientRect();
        const clip = board.hasAttribute("data-swirl") ? board.parentElement.getBoundingClientRect() : bounds;
        if (pointer.clientX < clip.left || pointer.clientX > clip.right ||
            pointer.clientY < clip.top || pointer.clientY > clip.bottom) continue;
        board.style.setProperty("--slash-light-x", `${100 * (pointer.clientX - bounds.left) / bounds.width}%`);
        board.style.setProperty("--slash-light-y", `${100 * (pointer.clientY - bounds.top) / bounds.height}%`);
        board.style.setProperty("--slash-light-opacity", "1");
        next.add(board);
      }
    }
    for (const board of lit) {
      if (!next.has(board)) board.style.removeProperty("--slash-light-opacity");
    }
    lit.clear();
    for (const board of next) lit.add(board);
  }

  function requestLighting() {
    if (!frame) frame = requestAnimationFrame(drawLight);
  }

  function clearLighting() {
    pointer = null;
    requestLighting();
  }

  const mutations = new MutationObserver((records) => {
    const boardsChanged = records.some(({ addedNodes, removedNodes }) =>
      [...addedNodes, ...removedNodes].some((node) =>
        node instanceof Element && (node.matches(selector) || node.querySelector(selector))));
    if (boardsChanged) scan();
  });

  scan();
  mutations.observe(document.body, { childList: true, subtree: true });

  window.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || !precisePointer.matches || reducedMotion.matches) return;
    pointer = event;
    requestLighting();
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", clearLighting);
  window.addEventListener("blur", clearLighting);
  window.addEventListener("scroll", () => {
    if (pointer) requestLighting();
  }, { passive: true });
  reducedMotion.addEventListener("change", () => {
    clearLighting();
    updateMotion();
  });
  precisePointer.addEventListener("change", clearLighting);
  document.addEventListener("visibilitychange", () => {
    clearLighting();
    updateMotion();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startGradientMotion, { once: true });
} else {
  startGradientMotion();
}
