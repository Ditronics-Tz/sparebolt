import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-bolt-700 text-white shadow-sm hover:bg-bolt-800 hover:shadow-md',
        secondary:
          'bg-muted text-foreground hover:bg-border/60 border border-border',
        outline:
          'border-2 border-bolt-600 text-bolt-700 dark:text-bolt-300 bg-transparent hover:bg-accent-soft',
        ghost:
          'hover:bg-muted text-muted-foreground hover:text-foreground',
        danger: 'bg-danger text-white hover:bg-red-700',
        amber:
          'bg-amber-signal text-steel-950 hover:bg-amber-500 shadow-sm',
      },
      size: {
        default: 'h-11 px-5 py-2 min-h-[44px]',
        sm: 'h-9 rounded-lg px-3 text-xs min-h-[36px]',
        lg: 'h-12 rounded-xl px-8 text-base min-h-[48px]',
        icon: 'h-11 w-11 min-h-[44px] min-w-[44px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={loading || props.disabled}
        {...props}
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';
