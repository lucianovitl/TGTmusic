import { useEffect, useState } from 'react';

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
  fullScreen?: boolean;
  overlay?: boolean;
}

export function Loading({
  size = 'md',
  className,
  text,
  fullScreen = false,
  overlay = false,
}: LoadingProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted && fullScreen) return null;

  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  const spinner = (
    <svg
      className={cn('animate-spin text-primary', sizeClasses[size])}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3',
        overlay && 'absolute inset-0 bg-background/80 backdrop-blur-sm z-50',
        fullScreen && 'fixed inset-0 z-50',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={text || 'Carregando'}
    >
      {spinner}
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );

  if (fullScreen || overlay) {
    return (
      <div className={cn('relative', fullScreen && 'fixed inset-0')}>
        {content}
      </div>
    );
  }

  return content;
}

export function LoadingDots({ className, color = 'text-primary' }: { className?: string; color?: string }) {
  return (
    <div className={cn('flex gap-1 items-center', className)} aria-label="Carregando">
      <span className={`${color} animate-bounce [animation-delay:-0.3s]`}>●</span>
      <span className={`${color} animate-bounce [animation-delay:-0.15s]`}>●</span>
      <span className={`${color} animate-bounce`}>●</span>
    </div>
  );
}

export function LoadingBar({ className }: { className?: string }) {
  return (
    <div className={cn('h-1 w-full bg-muted overflow-hidden rounded', className)}>
      <div className="h-full bg-primary animate-loading-bar" />
    </div>
  );
}

export function Skeleton({ className, variant = 'text', width, height }: {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
}) {
  const baseClasses = 'animate-pulse bg-muted rounded';
  const variantClasses = {
    text: 'h-4',
    circular: 'rounded-full',
    rectangular: '',
  };

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      style={{ width, height }}
    />
  );
}