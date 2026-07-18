import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../util/cx.js';

interface Base {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** A surface container. Compose with Card.Header / Body / Footer, or pass `title` for the simple case. */
export function Card({
  title,
  footer,
  padded = true,
  className,
  style,
  children,
}: Base & { title?: ReactNode; footer?: ReactNode; padded?: boolean }) {
  return (
    <div className={cx('lui-card', className)} style={style}>
      {title != null && (
        <div className="lui-card__header">
          {typeof title === 'string' ? <h3 className="lui-card__title">{title}</h3> : title}
        </div>
      )}
      <div className={cx('lui-card__body', !padded && 'lui-card__body--flush')}>{children}</div>
      {footer != null && <div className="lui-card__footer">{footer}</div>}
    </div>
  );
}
Card.Header = function CardHeader({ className, children }: Base) {
  return <div className={cx('lui-card__header', className)}>{children}</div>;
};
Card.Body = function CardBody({ className, children }: Base) {
  return <div className={cx('lui-card__body', className)}>{children}</div>;
};
Card.Footer = function CardFooter({ className, children }: Base) {
  return <div className={cx('lui-card__footer', className)}>{children}</div>;
};

export type Tone =
  'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'destructive' | 'info';

/** A small status label. */
export function Badge({
  tone = 'neutral',
  variant = 'soft',
  className,
  children,
}: Base & { tone?: Tone; variant?: 'soft' | 'solid' | 'outline' }) {
  return (
    <span className={cx('lui-badge', `lui-badge--${variant}`, `lui-badge--${tone}`, className)}>
      {children}
    </span>
  );
}

/** A removable tag / chip. */
export function Tag({
  tone = 'neutral',
  onRemove,
  className,
  children,
}: Base & { tone?: Tone; onRemove?: () => void }) {
  return (
    <span className={cx('lui-tag', `lui-tag--${tone}`, className)}>
      {children}
      {onRemove && (
        <button type="button" className="lui-tag__remove" aria-label="Remove" onClick={onRemove}>
          ×
        </button>
      )}
    </span>
  );
}

/** A user avatar — image, or initials fallback. */
export function Avatar({
  src,
  name,
  size = 'md',
  className,
}: {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return (
    <span
      className={cx('lui-avatar', `lui-avatar--${size}`, className)}
      role="img"
      aria-label={name}
    >
      {src ? (
        <img src={src} alt={name ?? ''} className="lui-avatar__img" />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}

/** Overlapping group of avatars. */
export function AvatarGroup({ className, children }: Base) {
  return <span className={cx('lui-avatar-group', className)}>{children}</span>;
}

/** A determinate/indeterminate progress bar (0–100). */
export function Progress({
  value,
  tone = 'primary',
  className,
}: {
  value?: number;
  tone?: Tone;
  className?: string;
}) {
  const pct = value == null ? undefined : Math.max(0, Math.min(100, value));
  return (
    <div
      className={cx('lui-progress', pct == null && 'lui-progress--indeterminate', className)}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx('lui-progress__bar', `lui-progress__bar--${tone}`)}
        style={{ width: pct == null ? undefined : `${pct}%` }}
      />
    </div>
  );
}

/** A loading spinner. */
export function Spinner({
  size = 'md',
  className,
  label = 'Loading',
}: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cx('lui-spinner', `lui-spinner--${size}`, className)}
      role="status"
      aria-label={label}
    />
  );
}

/** A shimmering placeholder for loading content. */
export function Skeleton({
  width,
  height,
  radius = 'md',
  className,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cx('lui-skeleton', `lui-skeleton--${radius}`, className)}
      style={{ width, height, ...style }}
      aria-hidden
    />
  );
}

/** An empty-state placeholder with an icon slot, title, description, and action. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('lui-empty', className)}>
      {icon && <div className="lui-empty__icon">{icon}</div>}
      <p className="lui-empty__title">{title}</p>
      {description && <p className="lui-empty__desc">{description}</p>}
      {action && <div className="lui-empty__action">{action}</div>}
    </div>
  );
}

/** A single statistic — label, value, optional delta. */
export function Stat({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('lui-stat', className)}>
      <div className="lui-stat__label">{label}</div>
      <div className="lui-stat__value">{value}</div>
      {hint && <div className="lui-stat__hint">{hint}</div>}
    </div>
  );
}
