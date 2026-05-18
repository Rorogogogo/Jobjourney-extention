import { useState } from 'react';
import { Button } from '@extension/ui';
import { IS_DEV } from '@extension/env';
import { MessageType } from '@extension/types';
import { FlaskConical } from 'lucide-react';

const JOB_COUNTS = [100, 500, 1000, 2000, 5000];

/**
 * Dev-only button that triggers a full mock scraping session.
 * Goes through the real pipeline: session → progress → storage → completion → sendJobsToFrontend.
 * Only renders in development mode.
 */
export const DevMockButton: React.FC = () => {
  const [count, setCount] = useState(1000);
  const [status, setStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  if (!IS_DEV) return null;

  const handleMockScrape = async () => {
    setIsRunning(true);
    setStatus('Starting mock scrape...');

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.MOCK_LARGE_SCRAPE,
        data: { count },
      });

      if (response?.success) {
        setStatus(`Mock scrape started: ${count} jobs`);
      } else {
        setStatus(`Error: ${response?.error || 'Unknown'}`);
      }
    } catch (error) {
      setStatus(`Failed: ${(error as Error).message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 p-2">
      <div className="mb-1 flex items-center gap-1">
        <FlaskConical className="h-3 w-3 text-amber-600" />
        <span className="text-[10px] font-semibold text-amber-700">Dev: Mock Scrape</span>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={count}
          onChange={e => setCount(Number(e.target.value))}
          className="h-7 rounded border border-amber-300 bg-white px-1.5 text-xs"
          disabled={isRunning}>
          {JOB_COUNTS.map(n => (
            <option key={n} value={n}>
              {n.toLocaleString()} jobs
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={handleMockScrape} disabled={isRunning} className="h-7 text-xs">
          {isRunning ? 'Running...' : 'Scrape'}
        </Button>
      </div>
      {status && <p className="mt-1 text-[10px] text-amber-600">{status}</p>}
    </div>
  );
};
