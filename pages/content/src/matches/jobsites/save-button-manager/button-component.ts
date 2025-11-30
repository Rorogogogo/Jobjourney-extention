// Save button UI component
import type { PRDetectionResult } from './types';

export class ButtonComponent {
  static createPRBadge(prDetection: PRDetectionResult): HTMLElement {
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
      badgeColor = '#22c55e'; // Green
      badgeText = 'PR Unknown';
    }

    const badge = document.createElement('div');
    badge.textContent = badgeText;
    badge.style.cssText = `
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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    return badge;
  }

  static addHoverEffects(button: HTMLElement) {
    // Hover effects for outline variant
    button.addEventListener('mouseenter', () => {
      if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
        button.style.backgroundColor = '#f8fafc';
        button.style.borderColor = '#cbd5e1';
      }
    });

    button.addEventListener('mouseleave', () => {
      if (!button.classList.contains('saving') && !button.classList.contains('saved')) {
        button.style.backgroundColor = '#ffffff';
        button.style.borderColor = '#e2e8f0';
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

      // Loading state styling
      button.style.background = 'transparent';
      button.style.color = 'black';
      button.style.border = '1px solid #ccc';
      button.style.pointerEvents = 'none';
      button.style.transform = 'scale(1)';
    } else {
      button.classList.remove('saving');
      button.textContent = 'Save in JJ';

      // Reset to default state
      button.style.background = '#ffffff';
      button.style.color = '#0f172a';
      button.style.border = '1px solid #e2e8f0';
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
        button.style.border = '1px solid black';
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

  static createBadges(analysis?: import('./types').JobData['analysis'], prDetection?: PRDetectionResult): HTMLElement {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    `;

    // Helper to create a single badge
    const createBadge = (text: string, color: string, bgColor: string, borderColor: string) => {
      const badge = document.createElement('span');
      badge.textContent = text;
      badge.style.cssText = `
        background-color: ${bgColor};
        color: ${color};
        padding: 2px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        border: 1px solid ${borderColor};
        line-height: 1.5;
        transition: all 0.2s ease;
      `;
      return badge;
    };

    // 1. PR Status Badge (First for visibility)
    if (prDetection) {
      let color = '#15803d'; // emerald-700
      let bg = '#f0fdf4'; // emerald-50
      let border = '#bbf7d0'; // emerald-200
      let text = 'No PR Req';

      if (prDetection.reasoning === 'Detecting PR requirements...') {
        color = '#1d4ed8'; // blue-700
        bg = '#eff6ff'; // blue-50
        border = '#bfdbfe'; // blue-200
        text = 'PR Detecting';
      } else if (prDetection.isRPRequired) {
        if (prDetection.confidence === 'high') {
          color = '#b91c1c'; // red-700
          bg = '#fef2f2'; // red-50
          border = '#fecaca'; // red-200
          text = 'PR Required';
        } else {
          color = '#b45309'; // amber-700
          bg = '#fffbeb'; // amber-50
          border = '#fde68a'; // amber-200
          text = prDetection.confidence === 'medium' ? 'PR Likely' : 'PR Maybe';
        }
      } else if (prDetection.confidence === 'low' && prDetection.matchedPatterns.length === 0) {
        color = '#374151'; // gray-700
        bg = '#f9fafb'; // gray-50
        border = '#e5e7eb'; // gray-200
        text = 'PR Unknown';
      }

      container.appendChild(createBadge(text, color, bg, border));
    }

    if (analysis) {
      // Work Arrangement
      if (analysis.workArrangement && analysis.workArrangement.type !== 'unknown') {
        const type = analysis.workArrangement.type;
        let color = '#15803d'; // emerald-700
        let bg = '#f0fdf4'; // emerald-50
        let border = '#bbf7d0'; // emerald-200

        if (type === 'hybrid') {
          color = '#7e22ce'; // purple-700
          bg = '#faf5ff'; // purple-50
          border = '#e9d5ff'; // purple-200
        } else if (type === 'on-site') {
          color = '#b91c1c'; // red-700
          bg = '#fef2f2'; // red-50
          border = '#fecaca'; // red-200
        }

        container.appendChild(createBadge(type.charAt(0).toUpperCase() + type.slice(1), color, bg, border));
      }

      // Employment Type
      if (analysis.employmentType && analysis.employmentType.type !== 'unknown') {
        const type = analysis.employmentType.type;
        let color = '#1d4ed8'; // blue-700
        let bg = '#eff6ff'; // blue-50
        let border = '#bfdbfe'; // blue-200

        if (type === 'contract') {
          color = '#b45309'; // amber-700
          bg = '#fffbeb'; // amber-50
          border = '#fde68a'; // amber-200
        } else if (type === 'part-time' || type === 'casual') {
          color = '#0e7490'; // cyan-700
          bg = '#ecfeff'; // cyan-50
          border = '#a5f3fc'; // cyan-200
        }

        container.appendChild(
          createBadge(type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' '), color, bg, border),
        );
      }

      // Experience Level
      if (analysis.experienceLevel && analysis.experienceLevel.level !== 'unknown') {
        const level = analysis.experienceLevel.level;
        let color = '#374151'; // gray-700
        let bg = '#f9fafb'; // gray-50
        let border = '#e5e7eb'; // gray-200

        if (level === 'senior' || level === 'lead') {
          color = '#c2410c'; // orange-700
          bg = '#fff7ed'; // orange-50
          border = '#fed7aa'; // orange-200
        } else if (level === 'junior' || level === 'graduate' || level === 'intern') {
          color = '#15803d'; // green-700
          bg = '#f0fdf4'; // green-50
          border = '#bbf7d0'; // green-200
        } else if (level === 'mid') {
          color = '#0369a1'; // sky-700
          bg = '#f0f9ff'; // sky-50
          border = '#bae6fd'; // sky-200
        }

        let text = level.charAt(0).toUpperCase() + level.slice(1);
        if (analysis.experienceLevel.years !== null) {
          text += ` (${analysis.experienceLevel.years}+ yrs)`;
        }

        container.appendChild(createBadge(text, color, bg, border));
      }

      // Tech Stack (Expandable Popover)
      if (analysis.techStack && analysis.techStack.count > 0) {
        const color = '#4338ca'; // indigo-700
        const bg = '#eef2ff'; // indigo-50
        const border = '#c7d2fe'; // indigo-200

        const badge = document.createElement('span');
        const allTech = analysis.techStack.technologies.join(', ');
        const topTech = analysis.techStack.technologies.slice(0, 3).join(', ');
        const truncatedText = analysis.techStack.count > 3 ? `${topTech} +${analysis.techStack.count - 3}` : topTech;

        badge.innerHTML = `
          <span>${truncatedText}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px; opacity: 0.7;">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        `;
        badge.style.cssText = `
          display: inline-flex;
          align-items: center;
          background-color: ${bg};
          color: ${color};
          padding: 2px 8px 2px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          border: 1px solid ${border};
          cursor: pointer;
          line-height: 1.5;
          transition: all 0.2s ease;
          max-width: 300px;
          position: relative;
        `;

        // Hover effect to indicate clickability
        badge.addEventListener('mouseenter', () => {
          badge.style.backgroundColor = '#e0e7ff'; // indigo-100
          badge.style.borderColor = '#a5b4fc'; // indigo-300
        });
        badge.addEventListener('mouseleave', () => {
          badge.style.backgroundColor = bg;
          badge.style.borderColor = border;
        });

        // Click to show popover
        badge.addEventListener('click', e => {
          e.preventDefault();
          e.stopPropagation();

          // Remove existing popover
          const existing = document.getElementById('jj-tech-popover');
          if (existing) existing.remove();

          const rect = badge.getBoundingClientRect();
          const popover = document.createElement('div');
          popover.id = 'jj-tech-popover';
          popover.textContent = allTech;
          popover.style.cssText = `
            position: fixed;
            top: ${rect.bottom + 8}px;
            left: ${rect.left}px;
            background: white;
            color: #1e293b;
            padding: 12px;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.5;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            border: 1px solid #e2e8f0;
            z-index: 2147483647;
            max-width: 300px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            animation: fadeIn 0.15s ease-out;
          `;

          // Add animation style
          const style = document.createElement('style');
          style.textContent = `
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `;
          popover.appendChild(style);
          document.body.appendChild(popover);

          // Close on click outside
          const close = () => {
            popover.remove();
            document.removeEventListener('click', close);
            window.removeEventListener('scroll', close);
          };

          // Delay adding listener to avoid immediate close
          setTimeout(() => {
            document.addEventListener('click', close);
            window.addEventListener('scroll', close, { passive: true });
          }, 0);
        });

        container.appendChild(badge);
      }
    }

    return container;
  }

  static createButton(_prDetection?: PRDetectionResult): HTMLElement {
    const button = document.createElement('button');
    button.id = 'jobjourney-save-button';

    // Filled button style for better clickability
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 16px;
      background-color: #0f172a; /* Slate 900 */
      color: white;
      border: 1px solid #0f172a;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    `;

    // Add hover effect
    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#1e293b'; /* Slate 800 */
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#0f172a';
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)';
    });

    // Button text
    const textSpan = document.createElement('span');
    textSpan.textContent = 'Save in JJ';
    button.appendChild(textSpan);

    // Note: PR Badge is now handled in createBadges, not on the button itself

    return button;
  }

  static createButtonContainer(): HTMLElement {
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'jobjourney-button-container';
    buttonContainer.style.cssText = `
      margin: 12px 0;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      padding: 6px 8px 6px 12px;
      background: white;
      border: 1px solid #e4e4e7;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      width: fit-content;
    `;

    // Add JobJourney Icon to the left
    const iconImg = document.createElement('img');
    iconImg.src = chrome.runtime.getURL('icon-128.png');
    iconImg.style.cssText = `
      width: 24px;
      height: 24px;
      object-fit: contain;
      border-radius: 4px;
    `;
    buttonContainer.appendChild(iconImg);

    return buttonContainer;
  }
}
