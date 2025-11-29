// JobJourney Page Indicator Module
// Creates and manages the indicator strip at the top of pages

// JobJourney Page Indicator Module
// Creates and manages the indicator strip at the top of pages

const INDICATOR_HEIGHT = 36;
const INDICATOR_ID = 'jobjourney-indicator';

// Helper to check if an element is a fixed header
function isFixedHeader(el: Element): boolean {
  // Fast checks first
  if (el.id === 'global-nav' || el.classList.contains('global-nav')) return true;
  if (el.tagName === 'HEADER') {
    const style = window.getComputedStyle(el);
    return style.position === 'fixed' || style.position === 'sticky';
  }

  const computedStyle = window.getComputedStyle(el);
  const position = computedStyle.position;
  const top = parseInt(computedStyle.top) || 0;

  // Check for fixed/sticky position
  if (position !== 'fixed' && position !== 'sticky') {
    return false;
  }

  // Check if it's at the top (allow small tolerance)
  if (top > INDICATOR_HEIGHT + 5) {
    return false;
  }

  // Heuristic: wide elements at the top are likely headers
  // We check clientWidth to ensure it's a visible, full-width bar
  return el.getAttribute('role') === 'banner' || (el.clientWidth > window.innerWidth * 0.8 && top <= 10);
}

// Adjust layout (body padding and fixed elements)
function adjustLayout() {
  // 1. Adjust Body Padding
  // LinkedIn and other SPAs might reset this, so we enforce it.
  if (document.body.style.paddingTop !== `${INDICATOR_HEIGHT}px`) {
    // Only store original if we haven't touched it yet
    if (!document.body.hasAttribute('data-jj-original-padding')) {
      document.body.setAttribute('data-jj-original-padding', document.body.style.paddingTop || '');
    }
    document.body.style.paddingTop = `${INDICATOR_HEIGHT}px`;
  }

  // 2. Adjust Fixed Elements
  // We query broadly to catch new elements inserted by SPA navigation
  const candidates = document.querySelectorAll('header, .global-nav, #global-nav, [role="banner"], div');

  candidates.forEach(el => {
    // Optimization: skip elements deep in the tree if possible, but for now be safe
    // Skip our own indicator and its children
    if (el.id === INDICATOR_ID || el.closest(`#${INDICATOR_ID}`)) return;

    // Skip hidden elements
    if ((el as HTMLElement).style.display === 'none') return;

    if (isFixedHeader(el)) {
      const element = el as HTMLElement;

      // Check if already adjusted
      if (element.hasAttribute('data-jj-adjusted')) {
        // Verify it's still correct (in case site overwrote style)
        const currentTop = parseInt(element.style.top) || 0;
        const originalTop = parseInt(element.getAttribute('data-jj-original-top') || '0');

        // If the current top is NOT what we expect (original + height), re-apply
        // We allow a small epsilon in case of sub-pixel rendering, but usually exact match is needed
        if (Math.abs(currentTop - (originalTop + INDICATOR_HEIGHT)) > 1) {
          element.style.setProperty('top', `${originalTop + INDICATOR_HEIGHT}px`, 'important');
          // console.log('Re-adjusting header:', element);
        }
        return;
      }

      // First time adjustment for this element
      const computedStyle = window.getComputedStyle(element);
      const currentTop = parseInt(computedStyle.top) || 0;

      // Store original
      element.setAttribute('data-jj-original-top', currentTop.toString());
      element.setAttribute('data-jj-adjusted', 'true');

      // Apply new top
      element.style.setProperty('top', `${currentTop + INDICATOR_HEIGHT}px`, 'important');

      console.log(`📍 Adjusted fixed element: ${element.tagName}.${element.className}`);
    }
  });
}

// Restore original layout
function restoreLayout() {
  // 1. Restore Body Padding
  const originalPadding = document.body.getAttribute('data-jj-original-padding');
  if (originalPadding !== null) {
    document.body.style.paddingTop = originalPadding;
    document.body.removeAttribute('data-jj-original-padding');
  } else {
    document.body.style.paddingTop = '';
  }

  // 2. Restore Fixed Elements
  const adjustedElements = document.querySelectorAll('[data-jj-adjusted="true"]');
  adjustedElements.forEach(el => {
    const element = el as HTMLElement;
    const originalTop = element.getAttribute('data-jj-original-top');

    if (originalTop !== null) {
      element.style.top = `${originalTop}px`;
    } else {
      element.style.top = '';
    }

    element.removeAttribute('data-jj-original-top');
    element.removeAttribute('data-jj-adjusted');
  });
}

// Create and inject JobJourney indicator strip
export function createJobJourneyIndicator() {
  // Check if indicator already exists
  if (document.getElementById(INDICATOR_ID)) {
    return;
  }

  // Don't show indicator on JobJourney websites
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('jobjourney.me') || hostname.includes('localhost')) {
    console.log('🔒 Skipping indicator on JobJourney website');
    return;
  }

  const indicator = document.createElement('div');
  indicator.id = INDICATOR_ID;
  indicator.innerHTML = `
    <div style="
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      height: ${INDICATOR_HEIGHT}px !important;
      background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%) !important;
      border-bottom: 3px solid #e9ecef !important;
      box-shadow: 0 2px 12px rgba(0,0,0,0.15) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      color: #333333 !important;
      backdrop-filter: blur(10px) !important;
      -webkit-backdrop-filter: blur(10px) !important;
      pointer-events: auto !important;
      opacity: 1 !important;
      visibility: visible !important;
    ">
      <div style="
        position: absolute !important;
        left: 0 !important;
        top: 0 !important;
        bottom: 0 !important;
        width: 8px !important;
        background: linear-gradient(180deg, #FF6B6B 0%, #4ECDC4 100%) !important;
      "></div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <img src="${chrome.runtime.getURL('icon-16.png')}" width="18" height="18" style="flex-shrink: 0; margin-bottom: 0 !important; vertical-align: middle !important;" alt="JobJourney" />
        <span>This page is enhanced with JobJourney Assistant</span>
        <div id="jobjourney-close-btn" style="
          margin-left: 8px;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          color: #666;
          font-weight: bold;
        " title="Hide indicator">×</div>
      </div>
    </div>
  `;

  // Insert the indicator at the beginning of the body
  document.body.insertBefore(indicator, document.body.firstChild);

  // Initial layout adjustment
  adjustLayout();

  // Setup MutationObserver to handle SPA navigation and dynamic updates
  let timeout: NodeJS.Timeout;
  const observer = new MutationObserver(() => {
    // Debounce updates slightly, but keep it snappy
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      adjustLayout();
    }, 50);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class', 'id'],
  });

  // Polling fallback: ensure layout is correct every 1s
  // This catches cases where MutationObserver might miss something or be suppressed
  const intervalId = setInterval(() => {
    adjustLayout();
  }, 1000);

  // Add click handler to show extension panel (but not on close button)
  indicator.addEventListener('click', e => {
    // Don't trigger panel opening if close button was clicked
    if ((e.target as HTMLElement).id === 'jobjourney-close-btn') {
      return;
    }

    // Send message to background to open side panel
    chrome.runtime
      .sendMessage({
        type: 'OPEN_SIDE_PANEL',
      })
      .catch(() => {
        // Fallback: try to open extension popup
        console.log('📱 JobJourney Assistant is active on this page');
      });
  });

  // Add close button handler
  const closeBtn = indicator.querySelector('#jobjourney-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', e => {
      e.stopPropagation();

      // Disconnect observer and clear interval
      observer.disconnect();
      clearInterval(intervalId);

      // Restore layout
      restoreLayout();

      // Remove the indicator
      indicator.remove();
      console.log('🔒 JobJourney indicator hidden');
    });

    // Add hover effects
    closeBtn.addEventListener('mouseenter', () => {
      (closeBtn as HTMLElement).style.color = '#333';
    });
    closeBtn.addEventListener('mouseleave', () => {
      (closeBtn as HTMLElement).style.color = '#666';
    });
  }

  console.log('🎯 JobJourney indicator strip added to page');
}
