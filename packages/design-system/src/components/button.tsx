import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from 'react';
import { cx } from '../util/cx.js';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width. */
  block?: boolean;
  /** Show a spinner and disable interaction. */
  loading?: boolean;
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

/** The primary action control. Six variants × three sizes, with loading + icon slots. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    block,
    loading,
    startIcon,
    endIcon,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      data-loading={loading || undefined}
      className={cx(
        'lui-button',
        `lui-button--${variant}`,
        `lui-button--${size}`,
        block && 'lui-button--block',
        className,
      )}
      {...rest}
    >
      {loading && <span className="lui-spinner lui-button__spinner" aria-hidden />}
      {!loading && startIcon && <span className="lui-button__icon">{startIcon}</span>}
      {children}
      {!loading && endIcon && <span className="lui-button__icon">{endIcon}</span>}
    </button>
  );
});

/** A square icon-only button. Requires an accessible `aria-label`. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  Omit<ButtonProps, 'startIcon' | 'endIcon' | 'block'> & { 'aria-label': string }
>(function IconButton({ variant = 'ghost', size = 'md', className, children, ...rest }, ref) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cx('lui-icon-button', className)}
      {...rest}
    >
      {children}
    </Button>
  );
});

/** Groups related buttons into a single segmented control. */
export function ButtonGroup({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div role="group" className={cx('lui-button-group', className)} style={style}>
      {children}
    </div>
  );
}
