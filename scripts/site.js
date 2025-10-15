import { loadSiteContent } from './renderContent.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadSiteContent();
  } catch (error) {
    console.error(error);
  } finally {
    initModeToggle();
    initCarousel();
  }
});

function initModeToggle() {
  const modeToggle = document.getElementById('modeToggle');
  if (!modeToggle) return;

  const sunIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.2" y1="4.2" x2="6.5" y2="6.5"/><line x1="17.5" y1="17.5" x2="19.8" y2="19.8"/><line x1="4.2" y1="19.8" x2="6.5" y2="17.5"/><line x1="17.5" y1="6.5" x2="19.8" y2="4.2"/></g></svg>';
  const moonIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.6A8.5 8.5 0 1 1 11.4 3 6.5 6.5 0 0 0 21 12.6z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

  function updateModeToggle() {
    const isLight = document.body.classList.contains('light-mode');
    const label = isLight ? 'Dark Mode' : 'Light Mode';
    modeToggle.innerHTML = `${isLight ? moonIcon : sunIcon}<span class="label">${label}</span>`;
    modeToggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
  }

  modeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    updateModeToggle();
  });

  updateModeToggle();
}

function initCarousel() {
  const viewport = document.getElementById('carouselViewport');
  const track = document.getElementById('carouselTrack');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (!viewport || !track || track.dataset.initialized === 'true') {
    return;
  }

  let slides = Array.from(track.children);
  const N = slides.length;
  if (N === 0) {
    return;
  }

  const fragLeft = document.createDocumentFragment();
  const fragRight = document.createDocumentFragment();
  slides.forEach(s => fragLeft.appendChild(s.cloneNode(true)));
  slides.forEach(s => fragRight.appendChild(s.cloneNode(true)));
  track.insertBefore(fragLeft, track.firstChild);
  track.appendChild(fragRight);

  slides = Array.from(track.children);
  let index = N;
  let autoTimer = null;
  let isAnimating = false;

  function slideOffset(i) {
    const s = slides[i];
    if (!s) return 0;
    const styles = getComputedStyle(viewport);
    const padL = parseFloat(styles.paddingLeft) || 0;
    const padR = parseFloat(styles.paddingRight) || 0;
    const vpW = viewport.clientWidth;
    const sW = s.clientWidth;
    const left = s.offsetLeft;

    const isFirstReal = (i === N);
    const isLastReal = (i === 2 * N - 1);

    if (isFirstReal) {
      return left - padL;
    }
    if (isLastReal) {
      return (left + sW) - (vpW - padR);
    }

    return left - (vpW - sW) / 2;
  }

  function setActive(i) {
    slides.forEach((el, k) => el.classList.toggle('active', k === i));
  }

  function centerOn(i, animate = true) {
    if (!slides[i]) return;
    if (!animate) {
      track.classList.add('no-anim');
    } else {
      track.classList.remove('no-anim');
      isAnimating = true;
    }
    const left = slideOffset(i);
    track.style.transform = `translate3d(${-left}px,0,0)`;
    setActive(i);
    if (!animate) {
      requestAnimationFrame(() => track.classList.remove('no-anim'));
    }
  }

  function prewrap(target) {
    if (target >= 2 * N) {
      index = target - N;
      centerOn(index, false);
      return index;
    }
    if (target < N) {
      index = target + N;
      centerOn(index, false);
      return index;
    }
    return target;
  }

  function go(delta) {
    if (isAnimating) return;
    let target = index + delta;
    target = prewrap(target);
    index = target;
    centerOn(index, true);
  }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(() => go(1), 5000);
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  function restartAuto() {
    stopAuto();
    startAuto();
  }

  window.addEventListener('resize', () => centerOn(index, false));

  track.addEventListener('transitionend', (event) => {
    if (event.target !== track || event.propertyName !== 'transform') return;
    isAnimating = false;
  });

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      go(-1);
      restartAuto();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      go(1);
      restartAuto();
    });
  }

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  if (viewport) {
    viewport.addEventListener('touchstart', (event) => {
      if (!event.touches[0]) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      startTime = Date.now();
      stopAuto();
    }, { passive: true });

    viewport.addEventListener('touchend', (event) => {
      const touch = event.changedTouches[0];
      if (!touch) {
        restartAuto();
        return;
      }
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const dt = Date.now() - startTime;
      const horizontal = Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 30 && dt < 600;
      if (horizontal) {
        go(dx < 0 ? 1 : -1);
      }
      restartAuto();
    }, { passive: true });
  }

  requestAnimationFrame(() => {
    slides = Array.from(track.children);
    index = N;
    centerOn(index, false);
    startAuto();
  });

  window.addEventListener('load', () => centerOn(index, false));

  track.dataset.initialized = 'true';
}
