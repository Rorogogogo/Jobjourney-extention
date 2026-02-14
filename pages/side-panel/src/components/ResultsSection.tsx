import type React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Badge } from '@extension/ui';
import { CheckCircle2, Copy, ExternalLink, Briefcase, MapPin, Building2, LayoutGrid, RotateCcw } from 'lucide-react';
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
  isAlreadyApplied?: boolean;
  appliedDateUtc?: string | null;
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

const PLATFORM_LABELS: Record<string, string> = {
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
    if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
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
      const response = await chrome.runtime.sendMessage({
        type: 'SHOW_JOBS_IN_JOBJOURNEY',
        data: { sessionId: results.sessionId },
      });

      if (!response.success) {
        console.error('Failed to show jobs in JobJourney:', response.error);
      }
    } catch (error) {
      const jobMarketUrl = await getJobMarketUrl();
      chrome.tabs.create({ url: jobMarketUrl, active: true });
    }
  };

  const platformStats = getPlatformStats();

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="space-y-2 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-lg font-bold tracking-tight">Search Complete!</h2>
        <p className="text-muted-foreground text-xs">
          Found {results.totalJobs} jobs in {formatDuration(results.duration)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Card className="border-primary/10 bg-primary/5 shadow-none">
          <CardContent className="p-3 text-center">
            <div className="text-primary text-2xl font-bold">{results.totalJobs}</div>
            <div className="text-muted-foreground text-[10px] font-medium">Total Jobs</div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="flex h-full flex-col items-center justify-center p-3">
            <div className="flex flex-wrap justify-center gap-1">
              {Object.entries(PLATFORM_LABELS).map(([key, label]) => {
                const count = platformStats[key];
                if (!count) return null;
                return (
                  <Badge key={key} variant="secondary" className="px-1.5 py-0.5 text-[10px]">
                    {label}: {count}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {results.jobs.slice(0, 3).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Latest Jobs</h3>
            <Badge variant="outline" className="text-[10px]">
              Top 3
            </Badge>
          </div>

          <div className="space-y-2">
            {results.jobs.slice(0, 3).map((job, idx) => (
              <Card key={job.id || idx} className="overflow-hidden shadow-sm">
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="line-clamp-1 text-sm font-medium">{job.title}</div>
                    <Badge variant="outline" className="shrink-0 text-[10px] uppercase">
                      {job.platform}
                    </Badge>
                  </div>
                  <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    <Building2 className="h-3 w-3" />
                    <span className="truncate">{job.company}</span>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{job.location}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {results.jobs.length > 3 && (
            <p className="text-muted-foreground text-center text-[10px]">...and {results.jobs.length - 3} more</p>
          )}
        </div>
      )}

      <div className="mt-auto grid gap-2 pt-2">
        <Button onClick={handleViewJobs} className="w-full gap-2 text-sm shadow-sm" size="default">
          <LayoutGrid className="h-4 w-4" /> View All in Dashboard
        </Button>
        <Button variant="outline" onClick={onSearchAgain} className="w-full gap-2 text-sm">
          <RotateCcw className="h-4 w-4" /> Start New Search
        </Button>
      </div>
    </div>
  );
};
