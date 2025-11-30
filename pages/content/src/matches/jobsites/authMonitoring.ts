// Authentication monitoring for JobJourney domains

// Authentication monitoring for JobJourney domains
export const initializeAuthMonitoring = () => {
  const hostname = window.location.hostname.toLowerCase();
  if (
    hostname === 'jobjourney.me' ||
    hostname.endsWith('.jobjourney.me') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  ) {
    console.log('🔐 JobJourney domain detected - setting up event-driven auth monitoring');

    // Store monitoring state and last known auth state for change detection
    (window as any).authMonitoringActive = true;
    (window as any).lastAuthState = null;
    (window as any).lastAuthData = null; // Track full auth data for comparison

    // Check current auth status immediately (but not on auth/sign-in pages)
    const isAuthPage =
      window.location.pathname.includes('extension-auth') ||
      window.location.pathname.includes('sign-in') ||
      window.location.pathname.includes('login') ||
      window.location.search.includes('source=extension');

    // Always perform initial auth check, but with special handling for auth pages
    setTimeout(() => {
      if ((window as any).authMonitoringActive) {
        if (isAuthPage) {
          console.log('🔐 Auth page detected - performing silent initial auth sync');
          (window as any).isAuthPageInitialCheck = true; // Flag for silent sync
        }
        checkAndSyncAuthStatus();
      }
    }, 500); // Initial detection after page load

    // No periodic polling - purely event-driven for better performance
    // Auth changes will be detected instantly via localStorage monitoring

    // Set up localStorage event listener for immediate detection
    window.addEventListener('storage', e => {
      if (e.key === 'auth' && (window as any).authMonitoringActive) {
        console.log('🔍 localStorage auth change detected via storage event');
        setTimeout(() => checkAndSyncAuthStatus(), 50); // Small delay to ensure DOM updates
      }
    });

    // Override localStorage methods for instant detection (KEY IMPROVEMENT!)
    monitorLocalStorageChanges();

    // Set up lightweight URL change detection (no heavy DOM watching)
    let lastUrl = window.location.href;
    const checkUrlChange = () => {
      if (!(window as any).authMonitoringActive) return;

      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('🔍 URL change detected, checking auth status');
        setTimeout(() => checkAndSyncAuthStatus(), 300);
      }
    };

    // Check URL changes only on user interaction (much more efficient)
    window.addEventListener('popstate', checkUrlChange);
    window.addEventListener('pushstate', checkUrlChange); // For SPA navigation

    // Lightweight observer for auth-specific changes only
    const observer = new MutationObserver(mutations => {
      if (!(window as any).authMonitoringActive) return;

      // Only check if auth-related elements might have changed
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);
          const removedNodes = Array.from(mutation.removedNodes);
          for (const node of [...addedNodes, ...removedNodes]) {
            if (node.nodeType === 1) {
              const element = node as Element;
              const text = element.textContent?.toLowerCase() || '';
              const className = element.className?.toString().toLowerCase() || '';

              if (
                text.includes('sign') ||
                text.includes('login') ||
                text.includes('auth') ||
                className.includes('auth') ||
                className.includes('login') ||
                className.includes('user')
              ) {
                shouldCheck = true;
                break;
              }
            }
          }
        }
        if (shouldCheck) break;
      }

      if (shouldCheck) {
        console.log('🔍 Auth-related DOM change detected');
        setTimeout(() => checkAndSyncAuthStatus(), 500);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false,
    });

    // Note: beforeunload listener removed to avoid Permissions Policy violations
    // on sites like LinkedIn. Content scripts are automatically cleaned up on page unload.

    // Listen for extension storage bridge messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('🔵 JobJourney page received message:', message.type);

      if (message.type === 'EXTENSION_SIGN_OUT_COMMAND') {
        handleExtensionSignOutCommand(sendResponse);
        return true; // Keep message channel open for async response
      }

      if (message.type === 'EXTENSION_JOBS_PROCESSED') {
        try {
          const { jobs, config, timestamp, source } = message.data;
          console.log(`📋 Received ${jobs.length} jobs directly from extension`);

          // Dispatch custom event to the page
          const customEvent = new CustomEvent('extension-jobs-processed', {
            detail: {
              jobs: jobs,
              config: config,
              timestamp: timestamp,
              source: source,
            },
          });

          window.dispatchEvent(customEvent);
          console.log('✅ Jobs data dispatched to page');

          sendResponse({ success: true, message: 'Jobs received and dispatched' });
        } catch (error) {
          console.error('❌ Error handling extension jobs:', error);
          sendResponse({ success: false, error: (error as Error).message });
        }
      }

      return true; // Keep message channel open for async response
    });

    console.log('✅ Authentication monitoring initialized');
  }
};

/**
 * Check current authentication status and sync with extension
 */
const checkAndSyncAuthStatus = () => {
  try {
    // Check if monitoring is still active and extension context is valid
    if (!(window as any).authMonitoringActive) {
      console.log('🔄 Auth monitoring disabled, skipping check');
      return;
    }

    if (!chrome.runtime || !chrome.runtime.sendMessage) {
      console.log('🔄 Extension context invalidated, stopping auth monitoring');
      (window as any).authMonitoringActive = false;
      return;
    }

    const authData = detectAuthenticationData();
    const currentAuthState = authData ? 'authenticated' : 'unauthenticated';
    const lastAuthState = (window as any).lastAuthState;
    const lastAuthData = (window as any).lastAuthData;

    // Compare both state and data to detect meaningful changes
    const authDataChanged = JSON.stringify(authData) !== JSON.stringify(lastAuthData);
    const stateChanged = currentAuthState !== lastAuthState;

    // Special handling for auth pages - don't send "signed out" messages during sign-in process
    const isAuthPage =
      window.location.pathname.includes('extension-auth') ||
      window.location.pathname.includes('sign-in') ||
      window.location.pathname.includes('login') ||
      window.location.search.includes('source=extension');

    // Check if this is an initial auth page check
    const isAuthPageInitialCheck = (window as any).isAuthPageInitialCheck;
    if (isAuthPageInitialCheck) {
      (window as any).isAuthPageInitialCheck = false; // Clear flag after first use
    }

    const shouldSkipSignOutMessage =
      isAuthPage &&
      currentAuthState === 'unauthenticated' &&
      (lastAuthState === null || lastAuthState === 'pending') &&
      !isAuthPageInitialCheck; // Allow sync on initial check

    // Skip initial detection if this is the first check on a new tab
    // This prevents false "sign in" toasts when opening existing authenticated tabs
    // BUT we should still sync with extension if extension doesn't know about auth
    const isInitialCheck = lastAuthState === null;
    const shouldSkipInitialAuthMessage = isInitialCheck && currentAuthState === 'authenticated' && !isAuthPage;

    // Handle auth data messaging with smarter logic to prevent duplicate toasts
    if (authData && !shouldSkipSignOutMessage) {
      // We have auth data - decide whether to send message
      const shouldSendAuthMessage = (stateChanged || authDataChanged) && !shouldSkipInitialAuthMessage;

      if (shouldSendAuthMessage) {
        console.log(`🔄 Auth changed: ${lastAuthState} → ${currentAuthState}`, { dataChanged: authDataChanged });

        // Send auth data with a flag indicating if this should trigger a toast
        // Don't show toast on auth pages even for real changes
        const shouldShowToast = !isAuthPage;

        try {
          chrome.runtime.sendMessage(
            {
              type: 'AUTH_DETECTED',
              data: authData,
              shouldShowToast: shouldShowToast,
            },
            response => {
              if (chrome.runtime?.lastError) {
                const errorMessage = chrome.runtime.lastError.message || '';
                if (errorMessage.includes('Extension context invalidated')) {
                  console.log('🔄 Extension context invalidated during auth sync');
                  return;
                }
                console.warn('Failed to send auth data:', errorMessage);
              } else if (response) {
                console.log('✅ Auth data synced with extension:', response);
              }
            },
          );
        } catch {
          console.log('🔄 Extension context invalidated during message send');
          return;
        }
      } else if (shouldSkipInitialAuthMessage || isAuthPageInitialCheck) {
        // Sync with extension but don't trigger toast (silent sync)
        const syncReason = isAuthPageInitialCheck ? 'auth page initial check' : 'existing tab';
        console.log(`🔐 Initial auth detected on ${syncReason} - syncing with extension without toast`);

        try {
          chrome.runtime.sendMessage(
            {
              type: 'AUTH_DETECTED',
              data: authData,
              shouldShowToast: false, // Silent sync, no toast
            },
            response => {
              if (chrome.runtime?.lastError) {
                const errorMessage = chrome.runtime.lastError.message || '';
                if (errorMessage.includes('Extension context invalidated')) {
                  console.log('🔄 Extension context invalidated during auth sync');
                  return;
                }
                console.warn('Failed to send auth data:', errorMessage);
              } else if (response) {
                console.log('✅ Auth data synced with extension (silent):', response);
              }
            },
          );
        } catch {
          console.log('🔄 Extension context invalidated during message send');
          return;
        }
      } else {
        console.log('🔍 Auth status unchanged - still authenticated');
      }

      // Always update state tracking
      (window as any).lastAuthState = currentAuthState;
      (window as any).lastAuthData = authData;
    } else if (!authData && (stateChanged || authDataChanged || isInitialCheck) && !shouldSkipSignOutMessage) {
      // No authentication found - send to extension for consistency
      const wasAuthenticated = lastAuthState === 'authenticated';
      const isFirstCheck = lastAuthState === null;

      if (wasAuthenticated) {
        console.log(`🔄 Auth changed: ${lastAuthState} → ${currentAuthState}`, { dataChanged: authDataChanged });
        console.log('🔓 No authentication detected - user signed out');

        try {
          chrome.runtime.sendMessage(
            {
              type: 'AUTH_CLEARED',
              shouldShowToast: true, // Real sign-out, show toast
            },
            response => {
              if (chrome.runtime?.lastError) {
                const errorMessage = chrome.runtime.lastError.message || '';
                if (errorMessage.includes('Extension context invalidated')) {
                  console.log('🔄 Extension context invalidated during auth clear');
                  return;
                }
              } else if (response) {
                console.log('✅ Auth cleared in extension');
              }
            },
          );
        } catch {
          console.log('🔄 Extension context invalidated during auth clear');
        }
      } else if (isFirstCheck || isAuthPageInitialCheck) {
        // Initial check found no auth - sync with extension to ensure consistency
        const syncReason = isAuthPageInitialCheck ? 'auth page initial check' : 'initial check';
        console.log(`🔍 ${syncReason}: No auth found - syncing with extension for consistency`);

        try {
          chrome.runtime.sendMessage(
            {
              type: 'AUTH_CLEARED',
              shouldShowToast: false, // Silent sync, no toast for initial check
            },
            response => {
              if (chrome.runtime?.lastError) {
                const errorMessage = chrome.runtime.lastError.message || '';
                if (errorMessage.includes('Extension context invalidated')) {
                  console.log('🔄 Extension context invalidated during initial auth sync');
                  return;
                }
              } else if (response) {
                console.log('✅ Initial auth state synced with extension (unauthenticated)');
              }
            },
          );
        } catch {
          console.log('🔄 Extension context invalidated during initial auth sync');
        }
      } else {
        console.log('🔍 No auth detected but was already unauthenticated - no message needed');
      }

      // Update state tracking
      (window as any).lastAuthState = currentAuthState;
      (window as any).lastAuthData = authData;
    } else if (shouldSkipSignOutMessage) {
      console.log('🔐 Skipping sign-out message on auth page to prevent false toast');
      // Update state tracking without sending messages
      (window as any).lastAuthState = currentAuthState;
      (window as any).lastAuthData = authData;
    } else if (!authData) {
      // Still unauthenticated, no change
      console.log('🔍 Auth status unchanged - still unauthenticated');
    }
  } catch (error) {
    console.warn('Error in auth monitoring:', error);
  }
};

/**
 * Monitor localStorage changes for instant auth detection
 * This is our PRIMARY detection method - event-driven, zero CPU when idle
 * Only triggers when JobJourney actually changes auth data
 */
const monitorLocalStorageChanges = () => {
  console.log('🔧 Setting up event-driven localStorage monitoring');

  // Store original methods
  const originalSetItem = localStorage.setItem;
  const originalRemoveItem = localStorage.removeItem;
  const originalClear = localStorage.clear;

  // Define all possible auth keys to monitor (matching original extension)
  const authKeys = ['auth', 'authToken', 'token', 'jwt', 'user', 'userData', 'jobjourney_token', 'jobjourney_user'];

  // Override setItem to detect auth changes instantly
  localStorage.setItem = function (key: string, value: string) {
    originalSetItem.apply(this, [key, value]);

    // Check if it's any auth-related key
    if (
      authKeys.some(authKey => key.toLowerCase().includes(authKey.toLowerCase())) &&
      (window as any).authMonitoringActive
    ) {
      console.log('🔐 Auth-related localStorage WRITE detected:', key);
      setTimeout(() => checkAndSyncAuthStatus(), 10); // Ultra-fast detection
    }
  };

  // Override removeItem to detect logout instantly
  localStorage.removeItem = function (key: string) {
    originalRemoveItem.apply(this, [key]);

    if (
      authKeys.some(authKey => key.toLowerCase().includes(authKey.toLowerCase())) &&
      (window as any).authMonitoringActive
    ) {
      console.log('🔓 Auth-related localStorage REMOVAL detected:', key);
      setTimeout(() => checkAndSyncAuthStatus(), 10); // Ultra-fast detection
    }
  };

  // Override clear to detect full logout
  localStorage.clear = function () {
    originalClear.apply(this);

    if ((window as any).authMonitoringActive) {
      console.log('🔓 localStorage CLEAR detected - checking auth status');
      setTimeout(() => checkAndSyncAuthStatus(), 10);
    }
  };

  console.log('✅ localStorage monitoring installed');
};

/**
 * Detect authentication data from the current page
 */
const detectAuthenticationData = () => {
  console.log('🔍 Checking for authentication data...');

  // First check for the main auth object used by JobJourney
  const authKey = 'auth';
  const authData = localStorage.getItem(authKey);
  if (authData) {
    try {
      const parsed = JSON.parse(authData);
      let token = null;
      let userData = null;

      if (parsed.token) {
        token = parsed.token;
        console.log(`🔑 Found token in localStorage[${authKey}]:`, token.substring(0, 20) + '...');
      }
      if (parsed.data || parsed.user) {
        userData = parsed.data || parsed.user;
        console.log(`👤 Found user data in localStorage[${authKey}]:`, userData);
        console.log('👤 User data structure:', {
          id: userData?.id,
          email: userData?.email,
          firstName: userData?.firstName,
          lastName: userData?.lastName,
          phoneNumber: userData?.phoneNumber,
          userName: userData?.userName,
          profilePictureUrl: userData?.profilePictureUrl,
          title: userData?.title,
          location: userData?.location,
          websiteUrl: userData?.websiteUrl,
          linkedinUrl: userData?.linkedinUrl,
          githubUrl: userData?.githubUrl,
          summary: userData?.summary,
          isPro: userData?.isPro,
          proEndDateUtc: userData?.proEndDateUtc,
          isProActive: userData?.isProActive,
          freeTrialCount: userData?.freeTrialCount,
          createdOnUtc: userData?.createdOnUtc,
          editedOnUtc: userData?.editedOnUtc,
          deletedOnUtc: userData?.deletedOnUtc,
        });
      }

      if (token && userData) {
        return { token, user: userData };
      }
    } catch (e) {
      console.warn('Error parsing auth data:', e);
    }
  }

  // Fallback: check other possible keys
  const tokenKeys = [
    'authToken',
    'token',
    'jwt',
    'accessToken',
    'access_token',
    'jobjourney_token',
    'jobjourney_auth_token',
    'auth_token',
    'bearer_token',
    'authorization',
    'Authorization',
  ];

  const userKeys = [
    'user',
    'userData',
    'userInfo',
    'currentUser',
    'profile',
    'jobjourney_user',
    'jobjourney_user_data',
    'auth_user',
  ];

  let token = null;
  let userData = null;

  // Check for token
  for (const key of tokenKeys) {
    const value = localStorage.getItem(key);
    if (value) {
      token = value;
      console.log(`🔑 Found token in localStorage[${key}]:`, value.substring(0, 20) + '...');
      break;
    }
  }

  // Check for user data
  for (const key of userKeys) {
    const value = localStorage.getItem(key);
    if (value) {
      try {
        userData = JSON.parse(value);
        console.log(`👤 Found user data in localStorage[${key}]:`, userData);
        break;
      } catch {
        // Not JSON, treat as string
        userData = { email: value };
        console.log(`👤 Found user string in localStorage[${key}]:`, value);
        break;
      }
    }
  }

  if (token) {
    return { token, user: userData };
  }

  console.log('🔍 No authentication data found');
  return null;
};

/**
 * Handle sign-out command from extension
 * This triggers the JobJourney frontend's logout function
 */
function handleExtensionSignOutCommand(sendResponse: (response: any) => void): void {
  try {
    console.log('🔓 Extension sign-out command received - triggering frontend logout');

    // Try to trigger sign-out via the JobJourney frontend
    // We'll dispatch a custom event that the frontend can listen for
    const signOutEvent = new CustomEvent('extension-sign-out-request', {
      detail: {
        source: 'extension',
        timestamp: Date.now(),
      },
    });

    window.dispatchEvent(signOutEvent);

    // Also try to access the logout function directly if available
    // This is a backup approach in case the event listener isn't set up
    try {
      // Check if the logout function is available in global scope or React context
      if ((window as any).jobJourneyLogout && typeof (window as any).jobJourneyLogout === 'function') {
        console.log('🔓 Calling global logout function');
        (window as any).jobJourneyLogout();
      } else {
        // Try to find and click the logout button as a last resort
        const logoutButton = document.querySelector(
          '[data-testid="logout-button"], button[class*="logout"], a[href*="logout"]',
        );
        if (logoutButton) {
          console.log('🔓 Clicking logout button');
          (logoutButton as HTMLElement).click();
        }
      }
    } catch (directLogoutError) {
      console.log('🔓 Direct logout failed, relying on event dispatch:', directLogoutError);
    }

    sendResponse({
      success: true,
      message: 'Sign-out command dispatched to JobJourney frontend',
    });
  } catch (error) {
    console.error('❌ Failed to handle extension sign-out command:', error);
    sendResponse({
      success: false,
      error: 'Failed to trigger sign-out in JobJourney frontend',
    });
  }
}
