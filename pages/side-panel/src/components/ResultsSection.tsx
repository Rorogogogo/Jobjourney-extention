import type React from 'react';
import { getJobMarketUrl } from '../utils/environment';

interface JobData {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  platform: string;
  description?: string;
  salary?: string;
  postedDate?: string;
}

interface SearchResults {
  sessionId: string;
  jobs: JobData[];
  totalJobs: number;
  duration?: number;
}

interface ResultsSectionProps {
  results: SearchResults | null;
  onSearchAgain: () => void;
}

const PLATFORM_ICONS: Record<string, string> = {
  linkedin: '💼',
  seek: '🔍',
  indeed: '📋',
  jora: '🧭',
};

const PLATFORM_NAMES: Record<string, string> = {
  linkedin: 'LinkedIn',
  seek: 'SEEK',
  indeed: 'Indeed',
  jora: 'Jora',
};

export const ResultsSection: React.FC<ResultsSectionProps> = ({ results, onSearchAgain }) => {
  if (!results) return null;

  const formatDuration = (duration?: number) => {
    if (!duration) return '';
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  const getPlatformStats = () => {
    const stats: Record<string, number> = {};
    results.jobs.forEach(job => {
      stats[job.platform] = (stats[job.platform] || 0) + 1;
    });
    return stats;
  };

  const handleViewJobs = async () => {
    try {
      // Send message to background to show jobs in JobJourney
      const response = await chrome.runtime.sendMessage({
        type: 'SHOW_JOBS_IN_JOBJOURNEY',
        data: { sessionId: results.sessionId },
      });

      if (!response.success) {
        console.error('Failed to show jobs in JobJourney:', response.error);
      }
    } catch (error) {
      console.error('Error sending message to show jobs:', error);
      // Fallback to just opening the tab
      const jobMarketUrl = await getJobMarketUrl();
      chrome.tabs.create({ url: jobMarketUrl, active: true });
    }
  };

  const platformStats = getPlatformStats();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="text-xl">🎯</div>
        <div className="flex-1">
          <div className="mb-0.5 text-sm font-semibold">Discovery Complete!</div>
          <div className="text-xs text-white/70">
            Found {results.totalJobs} amazing opportunities
            {results.duration && ` in ${formatDuration(results.duration)}`}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-lg bg-white/5 p-2 text-center">
          <span className="block text-2xl font-bold text-cyan-400">{results.totalJobs}</span>
          <span className="text-xs text-white/70">Total Jobs</span>
        </div>

        <div className="flex flex-col gap-1.5">
          {Object.entries(platformStats).map(([platform, count]) => (
            <div key={platform} className="flex items-center gap-2 rounded-md bg-white/5 px-2.5 py-1.5 text-xs">
              <span className="text-sm">{PLATFORM_ICONS[platform] || '📄'}</span>
              <span className="flex-1 font-medium">{PLATFORM_NAMES[platform] || platform}</span>
              <span className="font-semibold text-cyan-400">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {results.jobs.slice(0, 2).length > 0 && (
        <div className="rounded-lg bg-white/5 p-2.5">
          <div className="mb-1.5 text-xs font-semibold text-white/80">Preview:</div>
          {results.jobs.slice(0, 2).map((job, index) => (
            <div key={job.id || index} className="border-b border-white/10 py-1.5 text-xs last:border-b-0">
              <div className="mb-0.5 font-semibold">{job.title}</div>
              <div className="mb-0.5 text-white/80">{job.company}</div>
              <div className="mb-0.5 text-white/60">{job.location}</div>
              <div className="text-[10px] text-cyan-400">
                {PLATFORM_ICONS[job.platform]} {PLATFORM_NAMES[job.platform]}
              </div>
            </div>
          ))}
          {results.jobs.length > 2 && (
            <div className="py-1 text-center text-xs text-white/60">...and {results.jobs.length - 2} more jobs</div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 px-3 py-2.5 text-xs font-semibold text-white transition-all duration-300 hover:from-blue-700 hover:to-blue-800"
          onClick={handleViewJobs}>
          <span>Show in JJ</span>
          <span>🚀</span>
        </button>
        <button
          className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-xs font-semibold text-white transition-all duration-300 hover:border-white/30 hover:bg-white/15"
          onClick={onSearchAgain}>
          Search Again
        </button>
      </div>
    </div>
  );
};
