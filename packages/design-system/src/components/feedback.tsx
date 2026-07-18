import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../util/cx.js';

export type Status = 'info' | 'success' | 'warning' | 'destructive' | 'neutral';

interface Base {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** An inline message box for contextual feedback. */
export function Alert({
  status = 'info',
  title,
  icon,
  onClose,
  className,
  style,
  children,
}: Base & { status?: Status; title?: ReactNode; icon?: ReactNode; onClose?: () => void }) {
  return (
    <div className={cx('lui-alert', `lui-alert--${status}`, className)} role="alert" style={style}>
      {icon && <span className="lui-alert__icon">{icon}</span>}
      <div className="lui-alert__content">
        {title != null && <p className="lui-alert__title">{title}</p>}
        {children != null && <div className="lui-alert__body">{children}</div>}
      </div>
      {onClose && (
        <button type="button" className="lui-alert__close" aria-label="Dismiss" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}

/** A softer, left-accented note — good for docs-style callouts. */
export function Callout({
  status = 'info',
  title,
  className,
  style,
  children,
}: Base & { status?: Status; title?: ReactNode }) {
  return (
    <div className={cx('lui-callout', `lui-callout--${status}`, className)} style={style}>
      {title != null && <p className="lui-callout__title">{title}</p>}
      <div className="lui-callout__body">{children}</div>
    </div>
  );
}

/** A full-width banner for app-level announcements. */
export function Banner({
  status = 'info',
  action,
  onClose,
  className,
  children,
}: Base & { status?: Status; action?: ReactNode; onClose?: () => void }) {
  return (
    <div className={cx('lui-banner', `lui-banner--${status}`, className)} role="status">
      <div className="lui-banner__content">{children}</div>
      {action && <div className="lui-banner__action">{action}</div>}
      {onClose && (
        <button type="button" className="lui-banner__close" aria-label="Dismiss" onClick={onClose}>
          ×
        </button>
      )}
    </div>
  );
}
