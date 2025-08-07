// Save button UI component
import type { PRDetectionResult } from './types';

export class ButtonComponent {
  static createButton(prDetection?: PRDetectionResult): HTMLElement {
    const button = document.createElement('button');
    button.id = 'jobjourney-save-button';

    // Get JobJourney icon from extension resources
    const iconUrl = chrome.runtime.getURL('icon-16.png');

    // Create PR badge HTML - show appropriate state
    let prBadgeHtml = '';
    if (prDetection) {
      let badgeColor = '#10b981'; // Green by default (no PR required)
      let badgeText = 'No PR Req';

      // Check if this is the "detecting" state
      if (prDetection.reasoning === 'Detecting PR requirements...') {
        badgeColor = '#3b82f6'; // Blue for detecting state
        badgeText = 'PR Detecting';
      } else if (prDetection.isRPRequired) {
        // PR is required - show warning colors
        badgeColor =
          prDetection.confidence === 'high' ? '#ef4444' : prDetection.confidence === 'medium' ? '#f59e0b' : '#6b7280';
        badgeText =
          prDetection.confidence === 'high'
            ? 'PR Required'
            : prDetection.confidence === 'medium'
              ? 'PR Likely'
              : 'PR Maybe';
      } else if (prDetection.confidence === 'low' && prDetection.matchedPatterns.length === 0) {
        // No clear indicators found
        badgeColor = '#6b7280'; // Gray
        badgeText = 'PR Unknown';
      }

      prBadgeHtml = `
        <div style="
          position: absolute;
          top: -8px;
          right: -8px;
          background: ${badgeColor};
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          z-index: 10000;
        ">${badgeText}</div>
      `;
    }

    button.innerHTML = `
      ${prBadgeHtml}
      <div style="display: flex; align-items: center; gap: 8px;">
        <img src="${iconUrl}" width="16" height="16" style="flex-shrink: 0; margin-bottom: 0 !important; vertical-align: middle !important;" alt="JobJourney" />
        <span>Save in JJ</span>
      </div>
    `;

    // Outline variant styling with reduced border radius
    button.style.cssText = `
      position: relative;
      background: transparent;
      color: black;
      border: 2px solid black;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: none;
      transform-origin: center;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
    `;

    ButtonComponent.addHoverEffects(button);
    ButtonComponent.addClickEffects(button);

    return button;
  }

  static addHoverEffects(button: HTMLElement) {
    // Hover effects for outline variant
    button.addEventListener('mouseenter', () => {
      if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
        button.style.background = 'black';
        button.style.color = 'white';
        button.style.borderColor = 'black';
        button.style.transform = 'scale(1.02)';
        button.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
        button.style.background = 'transparent';
        button.style.color = 'black';
        button.style.borderColor = 'black';
        button.style.transform = 'scale(1)';
        button.style.boxShadow = 'none';
      }
    });
  }

  static addClickEffects(button: HTMLElement) {
    // Click effect with multi-state animation
    button.addEventListener('mousedown', () => {
      if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
        button.style.transform = 'scale(0.98)';
      }
    });

    button.addEventListener('mouseup', () => {
      if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
        button.style.transform = 'scale(1.02)';
        setTimeout(() => {
          if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
            button.style.transform = 'scale(1)';
          }
        }, 100);
      }
    });
  }

  static setLoadingState(button: HTMLElement, loading: boolean) {
    if (loading) {
      button.classList.add('saving');
      button.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="
            width: 12px; 
            height: 12px; 
            border: 2px solid rgba(0,0,0,0.2); 
            border-top: 2px solid black; 
            border-radius: 50%; 
            animation: spin 1s linear infinite;
          "></div>
          <span>Saving...</span>
        </div>
        <style>
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      `;

      // Loading state styling - outline variant
      button.style.background = 'transparent';
      button.style.color = 'black';
      button.style.border = '2px solid #ccc';
      button.style.pointerEvents = 'none';
      button.style.transform = 'scale(1)';
    } else {
      button.classList.remove('saving');

      // Get JobJourney icon from extension resources
      const iconUrl = chrome.runtime.getURL('icon-16.png');

      button.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="${iconUrl}" width="16" height="16" style="flex-shrink: 0; margin-bottom: 0 !important; vertical-align: middle !important;" alt="JobJourney" />
          <span>Save in JJ</span>
        </div>
      `;

      // Reset to default outline state
      button.style.background = 'transparent';
      button.style.color = 'black';
      button.style.border = '2px solid black';
      button.style.pointerEvents = 'auto';
    }
  }

  static setSavedState(button: HTMLElement) {
    button.classList.add('saved');

    // Success animation with scale effect
    button.style.transform = 'scale(1.1)';

    setTimeout(() => {
      if (button) {
        button.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Saved!</span>
          </div>
        `;

        // Success state styling - filled variant
        button.style.background = 'black';
        button.style.color = 'white';
        button.style.border = '2px solid black';
        button.style.pointerEvents = 'none';
        button.style.transform = 'scale(1)';
      }
    }, 100);

    // Reset button after 2.5 seconds with smooth transition
    setTimeout(() => {
      if (button) {
        button.classList.remove('saved');

        // Smooth transition back to outline variant
        button.style.transition = 'all 0.3s ease';
        ButtonComponent.setLoadingState(button, false);
        button.style.pointerEvents = 'auto';

        // Reset transition after animation
        setTimeout(() => {
          if (button) {
            button.style.transition = 'all 0.15s ease';
          }
        }, 300);
      }
    }, 2500);
  }

  static createButtonContainer(): HTMLElement {
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'jobjourney-button-container';
    buttonContainer.style.cssText = `
      margin: 12px 0;
      display: flex;
      justify-content: center;
      align-items: center;
    `;
    return buttonContainer;
  }
}
