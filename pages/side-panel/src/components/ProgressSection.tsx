import type React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Progress, Badge, Button } from '@extension/ui';
import { Loader2, CheckCircle2, XCircle, AlertCircle, StopCircle, Briefcase, Globe } from 'lucide-react';
import { cn } from '@extension/ui';

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
      case 'pending': return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'active':
      case 'scraping': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return <Loader2 className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'scraping': return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">Processing</Badge>;
      case 'completed': return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Done</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      default: return <Badge variant="outline">Pending</Badge>;
    }
  };

  const getProgressPercentage = () => {
    if (platform.total === 0) return 0;
    const percentage = (platform.current / platform.total) * 100;
    return Math.min(100, Math.max(0, percentage));
  };
  
  const getPlatformName = (id: string) => {
     const names: Record<string, string> = {
        linkedin: 'LinkedIn',
        indeed: 'Indeed',
        seek: 'Seek',
        jora: 'Jora',
        reed: 'Reed'
     };
     return names[id.toLowerCase()] || id;
  };

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm transition-all">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {getStatusIcon(platform.status)}
          <span className="font-semibold capitalize">{getPlatformName(platform.platform)}</span>
        </div>
        <div className="flex items-center gap-2">
           {getStatusBadge(platform.status)}
        </div>
      </div>

      {(platform.status === 'active' || platform.status === 'scraping') && (
        <div className="space-y-1.5">
          <Progress value={getProgressPercentage()} className="h-1.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Processing... {platform.current} / {platform.total}</span>
            {platform.currentPage && <span>Page {platform.currentPage}</span>}
          </div>
        </div>
      )}

      {platform.status === 'completed' && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-green-600">
          <Briefcase className="h-3.5 w-3.5" />
          Found {platform.jobsFound} jobs
        </div>
      )}

      {platform.status === 'error' && platform.error && (
        <div className="mt-1 flex items-start gap-1 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{platform.error}</span>
        </div>
      )}
    </div>
  );
};

export const ProgressSection: React.FC<ProgressSectionProps> = ({ progress, onStop }) => {
  if (!progress) return null;

  const { totalPlatforms = 0, completedPlatforms = 0, jobsFound = 0 } = progress.progress || {};
  const progressPercentage = totalPlatforms > 0 ? (completedPlatforms / totalPlatforms) * 100 : 0;
  const platformProgress = progress.platformProgress || {};
  const allPlatforms = Object.values(platformProgress);

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-none">
        <CardHeader className="px-0 pt-0 pb-2">
           <div className="flex items-center justify-between">
             <CardTitle className="flex items-center gap-2 text-lg">
               <Loader2 className="h-5 w-5 animate-spin text-primary" />
               Searching Jobs...
             </CardTitle>
             <Badge variant="outline" className="font-medium">
               {completedPlatforms} / {totalPlatforms} Platforms
             </Badge>
           </div>
           <p className="text-sm text-muted-foreground">{progress.status || 'Initializing search...'}</p>
        </CardHeader>
        <CardContent className="px-0 pb-0">
           <Progress value={progressPercentage} className="h-2" />
           
           <div className="mt-4 grid grid-cols-2 gap-4">
             <div className="rounded-lg bg-secondary/50 p-3 text-center">
               <div className="text-xs font-medium text-muted-foreground">Jobs Found</div>
               <div className="text-2xl font-bold text-primary">{jobsFound}</div>
             </div>
             <div className="rounded-lg bg-secondary/50 p-3 text-center">
               <div className="text-xs font-medium text-muted-foreground">Status</div>
               <div className="text-sm font-semibold capitalize">{progress.status === 'starting' ? 'Starting' : 'Active'}</div>
             </div>
           </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Platform Progress</h3>
        <div className="space-y-2">
          {allPlatforms.length > 0 ? (
             allPlatforms.map(platform => <PlatformCard key={platform.platform} platform={platform} />)
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
               <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing platforms...
            </div>
          )}
        </div>
      </div>

      {progress.progress?.errors && progress.progress.errors.length > 0 && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertCircle className="h-4 w-4" /> Issues Encountered
          </div>
          <div className="space-y-1">
            {progress.progress.errors.map((error, index) => (
              <div key={index} className="flex items-start gap-2 text-xs text-destructive/80">
                <span className="mt-1 h-1 w-1 rounded-full bg-destructive" />
                <span>{error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button 
        variant="destructive" 
        className="w-full" 
        onClick={onStop}
        size="lg"
      >
        <StopCircle className="mr-2 h-4 w-4" /> Stop Search
      </Button>
    </div>
  );
};
