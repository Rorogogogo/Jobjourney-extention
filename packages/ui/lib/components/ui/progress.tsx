import * as React from 'react';
import { cn } from '../../utils';

const Progress = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value?: number | null }>(
  ({ className, value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('bg-secondary relative h-4 w-full overflow-hidden rounded-full', className)}
      {...props}>
      <div
        className="bg-primary h-full w-full flex-1 transition-all duration-300 ease-in-out"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </div>
  ),
);
Progress.displayName = 'Progress';

export { Progress };
