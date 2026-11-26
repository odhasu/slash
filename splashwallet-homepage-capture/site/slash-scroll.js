import Lenis from "./vendor/lenis-1.3.17.mjs";

const smoothWheel = matchMedia("(any-pointer: fine) and (prefers-reduced-motion: no-preference)");
const navigationKeys = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]);
let scroll;

function enableSmoothScroll() {
  if (!smoothWheel.matches || scroll) return;

  scroll = new Lenis({
    autoRaf: true,
    duration: 1.6,
    syncTouch: false,
    allowNestedScroll: true,
    stopInertiaOnNavigate: true,
    prevent: (element) => element.matches("dialog, [role='dialog']"),
    virtualScroll: ({ event, deltaX, deltaY }) =>
      event.type === "wheel" &&
      event.cancelable &&
      !event.defaultPrevented &&
      !event.shiftKey &&
      !event.metaKey &&
      Math.abs(deltaY) > Math.abs(deltaX),
  });
}

function disableSmoothScroll() {
  scroll?.destroy();
  scroll = undefined;
}

function stopGlide() {
  if (scroll?.isScrolling !== "smooth") return;
  scroll.stop();
  scroll.start();
}

smoothWheel.addEventListener("change", () => {
  if (smoothWheel.matches) enableSmoothScroll();
  else disableSmoothScroll();
});
window.addEventListener("pagehide", disableSmoothScroll);
window.addEventListener("pageshow", enableSmoothScroll);
window.addEventListener("popstate", stopGlide);
window.addEventListener("pointerdown", stopGlide, { passive: true });
window.addEventListener("keydown", (event) => {
  if (navigationKeys.has(event.key)) stopGlide();
});

enableSmoothScroll();
