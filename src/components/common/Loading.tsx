import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className={cn('animate-spin rounded-full border-2 border-muted border-t-primary', sizes[size])} />
    </div>
  );
}

export function LoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-secondary/50 rounded-xl', className)} />
  );
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-3">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
      <div className="aspect-video bg-secondary/50" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-secondary/50 rounded w-3/4" />
        <div className="h-3 bg-secondary/50 rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-6 w-16 bg-secondary/50 rounded-full" />
          <div className="h-6 w-20 bg-secondary/50 rounded-full" />
        </div>
      </div>
    </div>
  );
}
