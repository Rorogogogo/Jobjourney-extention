// JobJourney Page Indicator Module
// Creates and manages the indicator strip at the top of pages

// Helper function to generate a unique selector for an element
function getElementSelector(element: Element): string {
  if (element.id) return `#${element.id}`;
  if (element.className) {
    const classes = element.className
      .split(' ')
      .filter(c => c.trim())
      .slice(0, 3);
    if (classes.length > 0) return `.${classes.join('.')}`;
  }
  return element.tagName.toLowerCase();
}

// Create and inject JobJourney indicator strip
export function createJobJourneyIndicator() {
  // Check if indicator already exists
  if (document.getElementById('jobjourney-indicator')) {
    return;
  }

  // Don't show indicator on JobJourney websites
  const hostname = window.location.hostname.toLowerCase();
  if (hostname.includes('jobjourney.me') || hostname.includes('localhost')) {
    console.log('🔒 Skipping indicator on JobJourney website');
    return;
  }

  const indicator = document.createElement('div');
  indicator.id = 'jobjourney-indicator';
  indicator.innerHTML = `
    <div style="
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      height: 36px !important;
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

  // Store original values for cleanup
  const originalBodyPaddingTop = document.body.style.paddingTop;
  const originalBodyTransform = document.body.style.transform;

  // Push down the entire body content using transform
  document.body.style.paddingTop = `${36}px`;

  // Also try to find and adjust any fixed headers that might exist
  const fixedElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const computedStyle = window.getComputedStyle(el);
    return computedStyle.position === 'fixed' && parseInt(computedStyle.top) <= 10; // Elements fixed to the top
  });

  // Store original top values and adjust fixed elements
  const originalFixedTops: Map<Element, string> = new Map();
  fixedElements.forEach(el => {
    const computedStyle = window.getComputedStyle(el);
    const currentTop = parseInt(computedStyle.top) || 0;
    originalFixedTops.set(el, (el as HTMLElement).style.top || computedStyle.top);
    (el as HTMLElement).style.top = `${currentTop + 36}px`;
  });

  // Store original values for cleanup
  indicator.setAttribute('data-original-body-padding', originalBodyPaddingTop || '');
  indicator.setAttribute('data-original-body-transform', originalBodyTransform || '');
  indicator.setAttribute('data-fixed-elements-count', fixedElements.length.toString());

  // Store fixed element data for cleanup
  fixedElements.forEach((el, index) => {
    indicator.setAttribute(`data-fixed-${index}-top`, originalFixedTops.get(el) || '');
    indicator.setAttribute(`data-fixed-${index}-selector`, getElementSelector(el));
  });

  // Insert the indicator at the beginning of the body
  document.body.insertBefore(indicator, document.body.firstChild);

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

      // Restore original spacing values
      const originalBodyPadding = indicator.getAttribute('data-original-body-padding') || '';
      const originalBodyTransform = indicator.getAttribute('data-original-body-transform') || '';
      const fixedElementsCount = parseInt(indicator.getAttribute('data-fixed-elements-count') || '0');

      document.body.style.paddingTop = originalBodyPadding;
      document.body.style.transform = originalBodyTransform;

      // Restore fixed elements
      for (let i = 0; i < fixedElementsCount; i++) {
        const selector = indicator.getAttribute(`data-fixed-${i}-selector`);
        const originalTop = indicator.getAttribute(`data-fixed-${i}-top`);
        if (selector && originalTop) {
          try {
            const element = document.querySelector(selector) as HTMLElement;
            if (element) {
              element.style.top = originalTop;
            }
          } catch (e) {
            console.warn('Could not restore fixed element:', selector);
          }
        }
      }

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
