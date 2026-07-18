import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../util/cx.js';

type TextTone = 'default' | 'muted' | 'subtle' | 'primary' | 'destructive' | 'success' | 'warning';
type TextStyle = 'display' | 'heading' | 'title' | 'body' | 'small' | 'code';

interface TextBase {
  tone?: TextTone;
  align?: CSSProperties['textAlign'];
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  truncate?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const toneClass = (tone?: TextTone) =>
  tone && tone !== 'default' ? `lui-tone--${tone}` : undefined;

/** A section heading. `level` sets the tag (h1–h6); `variant` sets the type style (defaults by level). */
export function Heading({
  level = 2,
  variant,
  tone,
  align,
  className,
  style,
  children,
}: TextBase & { level?: 1 | 2 | 3 | 4 | 5 | 6; variant?: TextStyle }) {
  const Tag = `h${level}` as const;
  const v = variant ?? (level === 1 ? 'display' : level === 2 ? 'heading' : 'title');
  return (
    <Tag
      className={cx('lui-text', `lui-text--${v}`, toneClass(tone), className)}
      style={{ textAlign: align, ...style }}
    >
      {children}
    </Tag>
  );
}

/** Inline or block text at one of the type-scale styles. */
export function Text({
  as: As = 'span',
  variant = 'body',
  tone,
  align,
  weight,
  truncate,
  className,
  style,
  children,
}: TextBase & { as?: 'span' | 'p' | 'div' | 'label'; variant?: TextStyle }) {
  return (
    <As
      className={cx(
        'lui-text',
        `lui-text--${variant}`,
        toneClass(tone),
        weight && `lui-weight--${weight}`,
        truncate && 'lui-truncate',
        className,
      )}
      style={{ textAlign: align, ...style }}
    >
      {children}
    </As>
  );
}

/** A paragraph of body copy. */
export function Paragraph(props: Omit<Parameters<typeof Text>[0], 'as' | 'variant'>) {
  return <Text as="p" variant="body" {...props} />;
}

/** A form field label. Associate with a control via `htmlFor`. */
export function Label({
  htmlFor,
  required,
  className,
  style,
  children,
}: {
  htmlFor?: string;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className={cx('lui-label', className)} style={style}>
      {children}
      {required && (
        <span className="lui-label__required" aria-hidden>
          {' '}
          *
        </span>
      )}
    </label>
  );
}

/** A hyperlink. */
export function Link({
  href,
  external,
  className,
  style,
  children,
}: {
  href: string;
  external?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <a
      href={href}
      className={cx('lui-link', className)}
      style={style}
      {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      {children}
    </a>
  );
}

/** Inline code. */
export function Code({ className, style, children }: TextBase) {
  return (
    <code className={cx('lui-code', className)} style={style}>
      {children}
    </code>
  );
}

/** A keyboard key. */
export function Kbd({ className, children }: { className?: string; children?: ReactNode }) {
  return <kbd className={cx('lui-kbd', className)}>{children}</kbd>;
}

/** A block quotation. */
export function Blockquote({ className, style, children }: TextBase) {
  return (
    <blockquote className={cx('lui-blockquote', className)} style={style}>
      {children}
    </blockquote>
  );
}

/** An ordered or unordered list. */
export function List({
  ordered,
  className,
  style,
  children,
}: {
  ordered?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={cx('lui-list', ordered && 'lui-list--ordered', className)} style={style}>
      {children}
    </Tag>
  );
}

/** A list item. */
export function ListItem({ className, children }: { className?: string; children?: ReactNode }) {
  return <li className={cx('lui-list__item', className)}>{children}</li>;
}
