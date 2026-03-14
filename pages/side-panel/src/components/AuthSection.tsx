import React, { useState, useEffect } from 'react';
import { MessageType } from '@extension/types';
import { Button } from '@extension/ui';
import { LogOut, User, Star, ExternalLink, Github } from 'lucide-react';
import { getAuthUrl, getJobMarketUrl } from '@extension/shared';
import type { AuthStatus } from '@extension/types';

interface AuthSectionProps {
  authStatus: AuthStatus;
  isAuthenticated: boolean;
}

export const AuthSection: React.FC<AuthSectionProps> = ({ authStatus, isAuthenticated }) => {
  const [showUserModal, setShowUserModal] = useState(false);
  const [githubStars, setGithubStars] = useState<number | null>(null);

  // Load GitHub stars
  useEffect(() => {
    fetch('https://api.github.com/repos/Rorogogogo/Jobjourney-extention')
      .then(res => res.json())
      .then(data => setGithubStars(data.stargazers_count))
      .catch(() => setGithubStars(null));
  }, []);

  const handleSignIn = async () => {
    const authUrl = await getAuthUrl();
    chrome.tabs.create({ url: authUrl, active: true });
  };

  const handleDashboard = async () => {
    const jobMarketUrl = await getJobMarketUrl();
    chrome.tabs.create({ url: jobMarketUrl, active: true });
  };

  const handleGitHub = () => {
    chrome.tabs.create({ url: 'https://github.com/Rorogogogo/Jobjourney-extention' });
  };

  const handleSignOut = async () => {
    try {
      setShowUserModal(false);
      await chrome.runtime.sendMessage({ type: MessageType.SIGN_OUT_USER });
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {!isAuthenticated ? (
          <Button variant="outline" size="sm" onClick={handleSignIn} className="h-8">
            Sign In
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="flex h-8 items-center gap-2 rounded-full px-2"
            onClick={() => setShowUserModal(true)}>
            {authStatus.user?.avatar ? (
              <img className="h-5 w-5 rounded-full object-cover" src={authStatus.user.avatar} alt="Profile" />
            ) : (
              <User className="h-4 w-4" />
            )}
            <span className="max-w-[80px] truncate text-xs font-medium">{authStatus.user?.firstName || 'User'}</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground h-8 w-8"
          onClick={handleDashboard}
          title="Dashboard">
          <ExternalLink className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="text-muted-foreground flex h-8 items-center gap-1.5 px-2.5"
          onClick={handleGitHub}
          title="GitHub">
          <Github className="h-4 w-4" />
          {githubStars !== null && <span className="text-xs font-medium">{githubStars}</span>}
        </Button>
      </div>

      {/* User Info Modal */}
      {/* User Info Popover */}
      {showUserModal && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowUserModal(false)} />
          <div
            className="animate-in fade-in zoom-in-95 absolute right-3 top-[3.25rem] z-50 w-72 origin-top-right overflow-hidden rounded-xl border bg-white shadow-xl duration-100" // top-13 to clear header
            onClick={e => e.stopPropagation()}
            role="dialog">
            <div className="flex items-center justify-between border-b bg-gray-50/50 p-3">
              <h3 className="text-muted-foreground text-xs font-semibold">Account</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full hover:bg-gray-200"
                onClick={() => setShowUserModal(false)}>
                <span className="text-lg leading-none">×</span>
              </Button>
            </div>
            <div className="p-3">
              <div className="flex items-center gap-3">
                {authStatus.user?.avatar ? (
                  <img
                    className="h-10 w-10 rounded-full border object-cover shadow-sm"
                    src={authStatus.user.avatar}
                    alt="Profile"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 overflow-hidden">
                  <div className="truncate text-sm font-semibold text-gray-900">{authStatus.user?.name || 'User'}</div>
                  <div className="text-muted-foreground truncate text-xs">{authStatus.user?.email}</div>
                </div>
              </div>
              <div className="mt-3">
                {authStatus.user?.isPro ? (
                  <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-2 py-1.5 text-blue-700">
                    <Star className="h-3.5 w-3.5 fill-blue-600 text-blue-600" />
                    <span className="text-xs font-medium">Pro Plan Active</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-2 py-1.5">
                    <span className="text-muted-foreground text-xs font-medium">Free Plan</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs text-blue-600"
                      onClick={() => chrome.tabs.create({ url: 'https://www.jobjourney.me/subscription' })}>
                      Upgrade
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <div className="border-t bg-gray-50/50 p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={handleSignOut}>
                <LogOut className="mr-2 h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
};
