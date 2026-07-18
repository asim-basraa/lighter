import type { CSSProperties, ElementType, ReactNode } from 'react';
import { cx } from '../util/cx.js';

export type SpaceScale =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12' | '16' | '20' | '24';

const gapVar = (s?: SpaceScale): CSSProperties | undefined =>
  s ? { gap: `var(--spacing-${s})` } : undefined;

interface BaseProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/** The lowest-level layout primitive — a styleable div with token-aware padding shorthand. */
export function Box({
  as: As = 'div',
  padding,
  className,
  style,
  children,
  ...rest
}: BaseProps & { as?: ElementType; padding?: SpaceScale }) {
  const s: CSSProperties = {
    ...(padding ? { padding: `var(--spacing-${padding})` } : {}),
    ...style,
  };
  return (
    <As className={cx('lui-box', className)} style={s} {...rest}>
      {children}
    </As>
  );
}

/** Flex container. `direction` + `gap` (spacing scale) + alignment. Vertical by default. */
export function Stack({
  direction = 'vertical',
  gap = '4',
  align,
  justify,
  wrap,
  className,
  style,
  children,
}: BaseProps & {
  direction?: 'vertical' | 'horizontal';
  gap?: SpaceScale;
  align?: CSSProperties['alignItems'];
  justify?: CSSProperties['justifyContent'];
  wrap?: boolean;
}) {
  return (
    <div
      className={cx('lui-stack', `lui-stack--${direction}`, className)}
      style={{
        ...gapVar(gap),
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Horizontal stack. */
export function HStack(props: Omit<Parameters<typeof Stack>[0], 'direction'>) {
  return <Stack {...props} direction="horizontal" />;
}
/** Vertical stack. */
export function VStack(props: Omit<Parameters<typeof Stack>[0], 'direction'>) {
  return <Stack {...props} direction="vertical" />;
}

/** CSS grid with a column count (or template) and a spacing-scale gap. */
export function Grid({
  columns = 2,
  gap = '4',
  className,
  style,
  children,
}: BaseProps & { columns?: number | string; gap?: SpaceScale }) {
  const template = typeof columns === 'number' ? `repeat(${columns}, minmax(0, 1fr))` : columns;
  return (
    <div
      className={cx('lui-grid', className)}
      style={{ gridTemplateColumns: template, ...gapVar(gap), ...style }}
    >
      {children}
    </div>
  );
}

/** A max-width, horizontally-centered content column. */
export function Container({
  size = 'lg',
  className,
  style,
  children,
}: BaseProps & { size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' }) {
  return (
    <div className={cx('lui-container', `lui-container--${size}`, className)} style={style}>
      {children}
    </div>
  );
}

/** Centers its children on both axes. */
export function Center({ className, style, children }: BaseProps) {
  return (
    <div className={cx('lui-center', className)} style={style}>
      {children}
    </div>
  );
}

/** Flexible spacer that pushes siblings apart in a flex container. */
export function Spacer() {
  return <div className="lui-spacer" aria-hidden />;
}

/** A hairline rule. Horizontal by default. */
export function Divider({
  orientation = 'horizontal',
  className,
  style,
}: {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cx('lui-divider', `lui-divider--${orientation}`, className)}
      style={style}
    />
  );
}

/** Constrains children to a fixed aspect ratio (e.g. 16/9). */
export function AspectRatio({
  ratio = 16 / 9,
  className,
  style,
  children,
}: BaseProps & { ratio?: number }) {
  return (
    <div className={cx('lui-aspect', className)} style={{ aspectRatio: String(ratio), ...style }}>
      {children}
    </div>
  );
}

/** The page shell: a titled header (optional actions) above a main content region. */
export function PageShell({
  title,
  actions,
  className,
  style,
  children,
}: BaseProps & { title?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={cx('lui-page', className)} style={style}>
      {(title || actions) && (
        <header className="lui-page__header">
          {title ? <h1 className="lui-page__title">{title}</h1> : <span />}
          {actions ? <div className="lui-page__actions">{actions}</div> : null}
        </header>
      )}
      <main className="lui-page__main">{children}</main>
    </div>
  );
}
