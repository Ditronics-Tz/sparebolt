import { cn } from '../../lib/utils';

const styles: Record<string, string> = {
  default: 'bg-accent-soft text-accent-soft-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  danger: 'bg-danger-soft text-danger-soft-foreground',
  muted: 'bg-muted text-muted-foreground',
  new: 'bg-success-soft text-success-soft-foreground',
  used: 'bg-info-soft text-info-soft-foreground',
  refurbished: 'bg-violet-soft text-violet-soft-foreground',
};

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode;
  variant?: keyof typeof styles;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        styles[variant] || styles.default,
        className,
      )}
    >
      {children}
    </span>
  );
}
