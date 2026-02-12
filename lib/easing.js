/**
 * Custom easing function: expo ease-in, quart ease-out
 * Provides slow start, fast acceleration, and firm landing
 */
export const customEase = (t) => {
  if (t < 0.5) {
    return Math.pow(2, 16 * t - 8) / 2; // Ease-in expo
  }
  return 1 - Math.pow(-2 * t + 2, 4) / 2; // Ease-out quart
};

/**
 * Snap easing: starts immediately, smooth deceleration
 * Better for scroll snapping where we need to "take over" from user scroll
 */
export const snapEase = (t) => {
  // Ease-out quart - starts fast, decelerates smoothly
  return 1 - Math.pow(1 - t, 4);
};

/**
 * Smooth scroll to a target Y position with custom easing
 * @param {number} targetY - Target scroll position
 * @param {number} duration - Animation duration in ms (default 1400)
 * @param {function} easingFn - Easing function (default: customEase)
 * @returns {Promise<void>} - Resolves when animation completes
 */
export function smoothScrollTo(targetY, duration = 1400, easingFn = customEase) {
  return new Promise((resolve) => {
    const start = window.scrollY;
    const distance = targetY - start;

    if (distance === 0) {
      resolve();
      return;
    }

    const startTime = performance.now();

    function scroll(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easingFn(progress);

      window.scrollTo(0, start + distance * eased);

      if (progress < 1) {
        requestAnimationFrame(scroll);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(scroll);
  });
}

/**
 * Smooth scroll to top (convenience wrapper)
 * @param {number} duration - Animation duration in ms (default 1400)
 * @returns {Promise<void>} - Resolves when animation completes
 */
export function smoothScrollToTop(duration = 1400) {
  return smoothScrollTo(0, duration);
}
