import type React from 'react';

interface PlatformProgress {
  platform: string;
  platformName?: string;
  status: 'pending' | 'active' | 'scraping' | 'completed' | 'error';
  current: number;
  total: number;
  jobsFound: number;
  currentPage?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  totalJobsFromPreviousPages?: number;
  error?: string;
}

interface ProgressData {
  sessionId: string;
  status: string;
  progress?: {
    totalPlatforms: number;
    completedPlatforms: number;
    currentPlatform?: string;
    jobsFound: number;
    errors: string[];
  };
  platformProgress?: Record<string, PlatformProgress>;
}

interface ProgressSectionProps {
  progress: ProgressData | null;
  onStop: () => void;
}

const PlatformCard: React.FC<{ platform: PlatformProgress }> = ({ platform }) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'active':
        return '🔄';
      case 'scraping':
        return '🔄';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-gray-400';
      case 'active':
        return 'text-blue-400';
      case 'scraping':
        return 'text-blue-400';
      case 'completed':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getProgressPercentage = () => {
    // If total is 0, return 0
    if (platform.total === 0) return 0;

    // Calculate percentage based on current/total
    const percentage = (platform.current / platform.total) * 100;
    return Math.min(100, Math.max(0, percentage));
  };

  const getPlatformIcon = (platformName: string) => {
    switch (platformName.toLowerCase()) {
      case 'linkedin':
        return '🔗';
      case 'indeed':
        return '🔍';
      case 'seek':
        return '🎯';
      case 'reed':
        return '📰';
      default:
        return '💼';
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3 transition-all duration-300">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getPlatformIcon(platform.platform)}</span>
          <span className="text-sm font-semibold capitalize">{platform.platform}</span>
          <span className={`text-lg ${getStatusColor(platform.status)}`}>{getStatusIcon(platform.status)}</span>
        </div>
        <div className="flex items-center gap-2">
          {platform.status === 'scraping' && platform.currentPage && (
            <span className="text-xs text-white/50">Page {platform.currentPage}</span>
          )}
          <div className="text-xs text-white/70">{platform.jobsFound} jobs</div>
        </div>
      </div>

      {(platform.status === 'active' || platform.status === 'scraping') && (
        <>
          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${getProgressPercentage()}%` }}></div>
          </div>
          <div className="text-xs text-white/70">
            Processing: {platform.current || 0} / {platform.total || 0}
          </div>
        </>
      )}

      {platform.status === 'completed' && (
        <div className="text-xs text-green-400">✓ Completed • Found {platform.jobsFound} jobs</div>
      )}

      {platform.status === 'error' && platform.error && (
        <div className="mt-1 text-xs text-red-400">⚠️ {platform.error}</div>
      )}

      {platform.status === 'pending' && <div className="text-xs text-gray-400">Waiting to start...</div>}
    </div>
  );
};

export const ProgressSection: React.FC<ProgressSectionProps> = ({ progress, onStop }) => {
  if (!progress) return null;

  const { totalPlatforms = 0, completedPlatforms = 0, jobsFound = 0 } = progress.progress || {};
  const progressPercentage = totalPlatforms > 0 ? (completedPlatforms / totalPlatforms) * 100 : 0;

  // Debug logging to see what values we're getting
  console.log('🔍 ProgressSection received:', {
    totalPlatforms,
    completedPlatforms,
    jobsFound,
    platformProgressCount: Object.keys(progress.platformProgress || {}).length,
    platformProgressStatuses: Object.values(progress.platformProgress || {}).map(
      (p: any) => `${p.platform}: ${p.status}`,
    ),
  });

  // Only use actual platform data, no defaults
  const platformProgress = progress.platformProgress || {};
  const allPlatforms = Object.values(platformProgress);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="animate-pulse text-2xl">⚡</div>
        <div className="flex-1">
          <div className="mb-1 text-base font-semibold">Discovering jobs...</div>
          <div className="text-xs text-white/70">{progress.status || 'Starting search across platforms'}</div>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="h-2 w-full overflow-hidden rounded-md bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500"
          style={{ width: `${progressPercentage}%` }}></div>
      </div>

      {/* Overall Stats */}
      <div className="flex justify-between gap-4">
        <div className="flex flex-col items-center text-center">
          <span className="text-xs text-white/70">Platforms:</span>
          <span className="text-base font-semibold text-white">
            {completedPlatforms} / {totalPlatforms}
          </span>
        </div>
        <div className="flex flex-col items-center text-center">
          <span className="text-xs text-white/70">Jobs Found:</span>
          <span className="text-lg font-bold text-cyan-400">{jobsFound}</span>
        </div>
      </div>

      {/* Platform-specific Progress Cards */}
      <div className="space-y-2">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs font-semibold text-white/80">Platform Progress:</div>
          {progress.progress?.currentPlatform && (
            <div className="text-xs capitalize text-blue-400">Currently: {progress.progress.currentPlatform}</div>
          )}
        </div>
        {allPlatforms.length > 0 ? (
          allPlatforms.map(platform => <PlatformCard key={platform.platform} platform={platform} />)
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-gray-500/30 bg-gray-500/10 px-3 py-4">
            <div className="flex items-center gap-2 text-white/60">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/60"></div>
              <span className="text-xs">Initializing platforms...</span>
            </div>
          </div>
        )}
      </div>

      {/* Errors Section */}
      {progress.progress?.errors && progress.progress.errors.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-red-400">⚠️ Issues Encountered:</div>
          <div className="space-y-1">
            {progress.progress.errors.map((error, index) => (
              <div key={index} className="flex items-start gap-2 text-xs text-white/80">
                <span className="mt-0.5 text-red-400">•</span>
                <span>{error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="mt-4 flex gap-2">
        <button
          className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400 transition-all duration-300 hover:bg-red-500/15"
          onClick={onStop}>
          <span>⏹</span>
          Stop & Save Current Jobs
        </button>
      </div>
    </div>
  );
};
