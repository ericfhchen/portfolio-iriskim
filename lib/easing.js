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
 * CSS cubic-bezier(0.4, 0, 0.2, 1) equivalent - Material Design standard easing
 * Must match the CSS transition timing function exactly for synchronized animations
 */
export const materialEase = (t) => {
  // Attempt to match cubic-bezier(0.4, 0, 0.2, 1)
  // This is an approximation using bezier math
  const p1x = 0.4, p1y = 0, p2x = 0.2, p2y = 1;

  // Solve for t in bezier x equation, then compute y
  // Using Newton-Raphson iteration
  let x = t;
  for (let i = 0; i < 8; i++) {
    const bx = 3 * p1x * x * (1 - x) * (1 - x) + 3 * p2x * x * x * (1 - x) + x * x * x;
    const dx = 3 * p1x * (1 - x) * (1 - x) - 6 * p1x * x * (1 - x) + 3 * p2x * 2 * x * (1 - x) - 3 * p2x * x * x + 3 * x * x;
    if (Math.abs(bx - t) < 0.0001) break;
    x -= (bx - t) / dx;
  }
  // Compute y from x
  return 3 * p1y * x * (1 - x) * (1 - x) + 3 * p2y * x * x * (1 - x) + x * x * x;
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
 * Animate both scroll and an element's padding simultaneously via JS
 * This ensures perfect synchronization by updating both in the same animation frame
 * @param {Object} options
 * @param {number} options.targetScrollY - Target scroll position
 * @param {HTMLElement} options.element - Element to animate padding on
 * @param {number} options.startPadding - Starting padding value
 * @param {number} options.targetPadding - Target padding value
 * @param {number} options.duration - Animation duration in ms
 * @param {function} options.easingFn - Easing function
 * @returns {Promise<void>} - Resolves when animation completes
 */
export function animateScrollAndPadding({
  targetScrollY,
  element,
  startPadding,
  targetPadding,
  duration = 800,
  easingFn = materialEase,
}) {
  return new Promise((resolve) => {
    const startScrollY = window.scrollY;
    const scrollDistance = targetScrollY - startScrollY;
    const paddingDistance = targetPadding - startPadding;

    const startTime = performance.now();

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easingFn(progress);

      // Update both in the same frame
      window.scrollTo(0, startScrollY + scrollDistance * eased);
      if (element) {
        element.style.paddingTop = `${startPadding + paddingDistance * eased}px`;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(animate);
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

/**
 * Cancellable smooth scroll to a target Y position
 * Returns an object with promise and cancel function
 * @param {number} targetY - Target scroll position
 * @param {number} duration - Animation duration in ms (default 400)
 * @param {function} easingFn - Easing function (default: materialEase)
 * @returns {{ promise: Promise<void>, cancel: () => void }}
 */
export function cancellableScrollTo(targetY, duration = 400, easingFn = materialEase) {
  let cancelled = false;
  let animationFrameId = null;

  const promise = new Promise((resolve) => {
    const start = window.scrollY;
    const distance = targetY - start;

    if (distance === 0) {
      resolve();
      return;
    }

    const startTime = performance.now();

    function scroll(currentTime) {
      if (cancelled) {
        resolve();
        return;
      }

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easingFn(progress);

      window.scrollTo(0, start + distance * eased);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(scroll);
      } else {
        resolve();
      }
    }

    animationFrameId = requestAnimationFrame(scroll);
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    }
  };
}
