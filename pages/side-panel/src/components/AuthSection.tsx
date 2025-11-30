import React, { useState } from 'react';
import { getAuthUrl, getJobMarketUrl } from '../utils/environment';

interface AuthStatus {
  isAuthenticated: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
    name: string;
    avatar?: string;
    isPro?: boolean;
  };
}

interface AuthSectionProps {
  authStatus: AuthStatus;
  isAuthenticated: boolean;
  onAuthCheck: () => void;
}

export const AuthSection: React.FC<AuthSectionProps> = ({ authStatus, isAuthenticated, onAuthCheck }) => {
  const [showUserModal, setShowUserModal] = useState(false);
  const [githubStars, setGithubStars] = useState<number | null>(null);

  // Load GitHub stars
  React.useEffect(() => {
    fetch('https://api.github.com/repos/Rorogogogo/Jobjourney-extention')
      .then(res => res.json())
      .then(data => setGithubStars(data.stargazers_count))
      .catch(() => setGithubStars(null));
  }, []);

  const handleSignIn = async () => {
    // Use global environment detection utility
    const authUrl = await getAuthUrl();
    chrome.tabs.create({
      url: authUrl,
      active: true,
    });
  };

  const handleDashboard = async () => {
    // Use global environment detection utility
    // Open job-market page for better user experience
    const jobMarketUrl = await getJobMarketUrl();
    chrome.tabs.create({
      url: jobMarketUrl,
      active: true,
    });
  };

  const handleGitHub = () => {
    chrome.tabs.create({ url: 'https://github.com/Rorogogogo/Jobjourney-extention' });
  };

  const handleSignOut = async () => {
    try {
      setShowUserModal(false);

      // Send sign-out command to background service
      const response = await chrome.runtime.sendMessage({
        type: 'SIGN_OUT_USER',
      });

      if (response?.success) {
        console.log('✅ Sign-out command successful:', response.message);
        // The extension will automatically detect the auth change and update UI
      } else {
        console.error('❌ Sign-out command failed:', response?.error);
      }
    } catch (error) {
      console.error('❌ Failed to send sign-out command:', error);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          {!isAuthenticated ? (
            <div className="flex gap-2">
              <button
                className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-all duration-300 hover:border-white/30 hover:bg-white/15"
                onClick={handleSignIn}>
                Sign In
              </button>
            </div>
          ) : (
            <div
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 transition-all duration-300 hover:bg-white/10"
              title="Click for user details"
              onClick={() => setShowUserModal(true)}>
              {authStatus.user?.avatar ? (
                <img className="h-5 w-5 rounded-full object-cover" src={authStatus.user.avatar} alt="Profile" />
              ) : (
                <span className="text-base">👤</span>
              )}
              <span className="whitespace-nowrap text-xs font-medium text-white">
                {authStatus.user?.firstName || 'User'}
              </span>
              {authStatus.user?.isPro && (
                <span className="rounded-full bg-gradient-to-r from-yellow-400 to-yellow-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black">
                  PRO
                </span>
              )}
            </div>
          )}

          <button
            className="cursor-pointer whitespace-nowrap rounded-lg bg-gradient-to-r from-white to-gray-200 px-3 py-1.5 text-xs font-semibold text-black transition-all duration-300 hover:from-gray-100 hover:to-gray-300"
            onClick={handleDashboard}>
            Dashboard
          </button>

          <button
            className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-gradient-to-r from-white to-gray-200 px-3 py-1.5 text-xs font-semibold text-black transition-all duration-300 hover:from-gray-100 hover:to-gray-300"
            onClick={handleGitHub}
            title="Star us on GitHub">
            <svg className="h-2.5 w-2.5" viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                fill="currentColor"
              />
            </svg>
            {githubStars !== null ? githubStars : 'Loading...'} ⭐
          </button>
        </div>
      </div>

      {/* User Info Modal */}
      {showUserModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setShowUserModal(false)}>
          <div
            className="max-h-[90vh] w-[90%] max-w-md overflow-hidden rounded-xl border border-gray-700 bg-gray-800"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-700 p-4">
              <h3 className="text-base font-semibold">User Information</h3>
              <button
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded border-none bg-none p-0 text-2xl text-white hover:bg-white/10"
                onClick={() => setShowUserModal(false)}>
                ×
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-3">
                {authStatus.user?.avatar && (
                  <img className="h-16 w-16 rounded-full object-cover" src={authStatus.user.avatar} alt="Profile" />
                )}
                <div className="flex-1">
                  <div className="mb-1 text-base font-semibold text-white">{authStatus.user?.name || 'User'}</div>
                  <div className="mb-1 text-xs text-white/70">{authStatus.user?.email || 'user@example.com'}</div>
                  <div className="text-xs text-cyan-400">{authStatus.user?.isPro ? 'Pro Account' : 'Free Account'}</div>
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-gray-700 p-4">
              <button
                className="cursor-pointer rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-all duration-300 hover:bg-red-500/15"
                onClick={handleSignOut}
                data-testid="logout-button">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
