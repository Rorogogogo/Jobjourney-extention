// Button UI management
export class ButtonManager {
  private button: HTMLElement | null = null;

  createButton(): HTMLElement {
    const button = document.createElement('button');
    button.id = 'jobjourney-save-button';

    // Get JobJourney icon from extension resources
    const iconUrl = chrome.runtime.getURL('icon-16.png');

    button.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <img src="${iconUrl}" width="16" height="16" style="flex-shrink: 0;" alt="JobJourney" />
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

    this.setupButtonEvents(button);
    this.button = button;
    return button;
  }

  private setupButtonEvents(button: HTMLElement) {
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

  setButtonLoading(loading: boolean) {
    if (!this.button) return;

    if (loading) {
      this.button.classList.add('saving');
      this.button.innerHTML = `
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
      this.button.style.background = 'transparent';
      this.button.style.color = 'black';
      this.button.style.border = '2px solid #ccc';
      this.button.style.pointerEvents = 'none';
      this.button.style.transform = 'scale(1)';
    } else {
      this.button.classList.remove('saving');

      // Get JobJourney icon from extension resources
      const iconUrl = chrome.runtime.getURL('icon-16.png');

      this.button.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <img src="${iconUrl}" width="16" height="16" style="flex-shrink: 0;" alt="JobJourney" />
          <span>Save in JJ</span>
        </div>
      `;

      // Reset to default outline state
      this.button.style.background = 'transparent';
      this.button.style.color = 'black';
      this.button.style.border = '2px solid black';
      this.button.style.pointerEvents = 'auto';
    }
  }

  setButtonSaved() {
    if (!this.button) return;

    this.button.classList.add('saved');

    // Success animation with scale effect
    this.button.style.transform = 'scale(1.1)';

    setTimeout(() => {
      if (this.button) {
        this.button.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="flex-shrink: 0;">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Saved!</span>
          </div>
        `;

        // Success state styling - filled variant
        this.button.style.background = 'black';
        this.button.style.color = 'white';
        this.button.style.border = '2px solid black';
        this.button.style.pointerEvents = 'none';
        this.button.style.transform = 'scale(1)';
      }
    }, 100);

    // Reset button after 2.5 seconds with smooth transition
    setTimeout(() => {
      if (this.button) {
        this.button.classList.remove('saved');

        // Smooth transition back to outline variant
        this.button.style.transition = 'all 0.3s ease';
        this.setButtonLoading(false);
        this.button.style.pointerEvents = 'auto';

        // Reset transition after animation
        setTimeout(() => {
          if (this.button) {
            this.button.style.transition = 'all 0.15s ease';
          }
        }, 300);
      }
    }, 2500);
  }

  removeButton() {
    // Remove the container (which contains the button)
    const container = document.getElementById('jobjourney-button-container');
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    // Also remove the button directly if it exists elsewhere
    if (this.button && this.button.parentNode) {
      this.button.parentNode.removeChild(this.button);
    }

    this.button = null;
  }

  addClickHandler(handler: () => void) {
    if (this.button) {
      this.button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        handler();
      });
    }
  }
}