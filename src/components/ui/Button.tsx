import { Button as BaseButton } from '@base-ui/react/button';
import { CircleNotch } from '@phosphor-icons/react';
import { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ComponentProps<typeof BaseButton> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-accent-blue text-white hover:bg-accent-blue/90 data-disabled:bg-bg-tertiary data-disabled:text-text-muted',
  secondary: 'bg-bg-tertiary text-text-primary hover:bg-bg-hover border border-border-primary data-disabled:opacity-50',
  ghost: 'bg-transparent text-text-primary hover:bg-bg-hover data-disabled:opacity-50',
  danger: 'bg-accent-red text-white hover:bg-accent-red/90 data-disabled:bg-bg-tertiary data-disabled:text-text-muted',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
  lg: 'px-4 py-2 text-sm gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, leftIcon, rightIcon, children, className, disabled, ...props }, ref) => {
    return (
      <BaseButton
        ref={ref}
        disabled={disabled || loading}
        focusableWhenDisabled={loading}
        className={`
          inline-flex items-center justify-center font-medium rounded-md transition-colors
          cursor-pointer data-disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className ?? ''}
        `}
        {...props}
      >
        {loading ? (
          <CircleNotch size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} weight="bold" className="animate-spin" />
        ) : leftIcon ? (
          leftIcon
        ) : null}
        {children}
        {!loading && rightIcon}
      </BaseButton>
    );
  }
);

Button.displayName = 'Button';
