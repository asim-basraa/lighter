'use client';

/**
 * @lighter/design-system — table & data-presentation components.
 *
 * From-scratch, dependency-light. The only cross-file import allowed here is `cx`; everything
 * else comes from React. All visual styling lives in ../styles/table.css and is driven purely by
 * design tokens (see that file). Class convention: `lui-<name>`, modifiers `lui-<name>--<variant>`,
 * parts `lui-<name>__<part>`.
 *
 * Contents:
 *   - Primitive table set: Table / Thead / Tbody / Tr / Th / Td — thin styled wrappers over the
 *     native elements so consumers compose freely.
 *   - DataTable<T>       — convenience renderer over the primitive set (columns + rows).
 *   - DescriptionList    — a <dl> term/description list.
 *   - Timeline           — vertical timeline with tone-colored dots and a connector line.
 *   - Rating             — star rating, static or keyboard-operable.
 */

import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
  type TableHTMLAttributes,
  type ThHTMLAttributes,
  type TdHTMLAttributes,
} from 'react';
import { cx } from '../util/cx.js';

/* ---- shared types ------------------------------------------------------- */

/** Horizontal alignment shared by Th / Td / DataTable columns. */
export type Align = 'left' | 'center' | 'right';

/** Row density for the primitive `Table` (and, by extension, `DataTable`). */
export type TableDensity = 'comfortable' | 'compact';

/* ---- primitive table set ------------------------------------------------ */

/**
 * A native `<table>` wrapped in a horizontal scroll container so wide tables never break the page
 * layout. Zebra striping and row hover are handled in CSS. Set `density` to tighten row padding.
 */
export const Table = forwardRef<
  HTMLTableElement,
  TableHTMLAttributes<HTMLTableElement> & { density?: TableDensity }
>(function Table({ density = 'comfortable', className, children, ...rest }, ref) {
  return (
    <div className="lui-table-wrap">
      <table ref={ref} className={cx('lui-table', `lui-table--${density}`, className)} {...rest}>
        {children}
      </table>
    </div>
  );
});

/** Table header group — a styled `<thead>`. */
export const Thead = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function Thead({ className, children, ...rest }, ref) {
    return (
      <thead ref={ref} className={cx('lui-table__head', className)} {...rest}>
        {children}
      </thead>
    );
  },
);

/** Table body group — a styled `<tbody>`. */
export const Tbody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function Tbody({ className, children, ...rest }, ref) {
    return (
      <tbody ref={ref} className={cx('lui-table__body', className)} {...rest}>
        {children}
      </tbody>
    );
  },
);

/** A table row — a styled `<tr>`. */
export const Tr = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(function Tr(
  { className, children, ...rest },
  ref,
) {
  return (
    <tr ref={ref} className={cx('lui-table__row', className)} {...rest}>
      {children}
    </tr>
  );
});

/** A header cell — a styled `<th>` with `scope="col"` and optional alignment. */
export const Th = forwardRef<
  HTMLTableCellElement,
  ThHTMLAttributes<HTMLTableCellElement> & { align?: Align }
>(function Th({ align = 'left', className, children, ...rest }, ref) {
  return (
    <th
      ref={ref}
      scope="col"
      className={cx('lui-table__th', `lui-table__th--${align}`, className)}
      {...rest}
    >
      {children}
    </th>
  );
});

/** A data cell — a styled `<td>` with optional alignment. */
export const Td = forwardRef<
  HTMLTableCellElement,
  TdHTMLAttributes<HTMLTableCellElement> & { align?: Align }
>(function Td({ align = 'left', className, children, ...rest }, ref) {
  return (
    <td ref={ref} className={cx('lui-table__td', `lui-table__td--${align}`, className)} {...rest}>
      {children}
    </td>
  );
});

/* ---- DataTable ---------------------------------------------------------- */

/** One column definition for {@link DataTable}. */
export interface DataTableColumn<T> {
  /** Stable key; also used to pull a default value from the row via `String(row[key])`. */
  key: string;
  /** Header content. */
  header: ReactNode;
  /** Cell alignment (header and body). */
  align?: Align;
  /** Custom cell renderer. Falls back to `String(row[key])` when omitted. */
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  /** Row key resolver; defaults to the array index. */
  getRowKey?: (row: T, i: number) => string | number;
  /** Rendered (spanning every column) when `rows` is empty. Defaults to "No data". */
  empty?: ReactNode;
  /** Row density, forwarded to the underlying `Table`. */
  density?: TableDensity;
  className?: string;
}

/**
 * A convenience table built from the primitive set. Give it `columns` and `rows`; each cell is
 * rendered by its column's `render`, or `String(row[col.key])` by default. When `rows` is empty a
 * single full-width cell shows `empty` (or "No data").
 *
 * The generic is intentionally simple: `T extends Record<string, unknown>` so the default renderer
 * can index rows by column key.
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  getRowKey,
  empty = 'No data',
  density,
  className,
}: DataTableProps<T>) {
  return (
    <Table density={density} className={className}>
      <Thead>
        <Tr>
          {columns.map((col) => (
            <Th key={col.key} align={col.align}>
              {col.header}
            </Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        {rows.length === 0 ? (
          <Tr>
            {/* One spanning cell keeps the empty state centered across the whole table. */}
            <Td className="lui-table__empty" colSpan={columns.length}>
              {empty}
            </Td>
          </Tr>
        ) : (
          rows.map((row, i) => (
            <Tr key={getRowKey ? getRowKey(row, i) : i}>
              {columns.map((col) => (
                <Td key={col.key} align={col.align}>
                  {col.render ? col.render(row) : String(row[col.key])}
                </Td>
              ))}
            </Tr>
          ))
        )}
      </Tbody>
    </Table>
  );
}

/* ---- DescriptionList ---------------------------------------------------- */

export interface DescriptionListItem {
  term: ReactNode;
  description: ReactNode;
}

export interface DescriptionListProps {
  items: DescriptionListItem[];
  /** `horizontal` lays term/description side-by-side; `vertical` stacks them. */
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/** A `<dl>` of term/description pairs. */
export function DescriptionList({
  items,
  orientation = 'horizontal',
  className,
}: DescriptionListProps) {
  return (
    <dl className={cx('lui-dl', `lui-dl--${orientation}`, className)}>
      {items.map((item, i) => (
        <div className="lui-dl__row" key={i}>
          <dt className="lui-dl__term">{item.term}</dt>
          <dd className="lui-dl__desc">{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---- Timeline ----------------------------------------------------------- */

/** Semantic tone controlling a timeline dot's color. */
export type TimelineTone = 'default' | 'primary' | 'success' | 'warning' | 'destructive';

export interface TimelineItem {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  tone?: TimelineTone;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

/** A vertical timeline: tone-colored dots connected by a line, each with a title/description/meta. */
export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cx('lui-timeline', className)}>
      {items.map((item, i) => (
        <li className="lui-timeline__item" key={i}>
          {/* The connector line is drawn via CSS on the item; the dot sits on top of it. */}
          <span
            className={cx('lui-timeline__dot', `lui-timeline__dot--${item.tone ?? 'default'}`)}
            aria-hidden
          />
          <div className="lui-timeline__content">
            <div className="lui-timeline__title">{item.title}</div>
            {item.meta != null && <div className="lui-timeline__meta">{item.meta}</div>}
            {item.description != null && (
              <div className="lui-timeline__desc">{item.description}</div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/* ---- Rating ------------------------------------------------------------- */

export interface RatingProps {
  value: number;
  /** Number of stars. Defaults to 5. */
  max?: number;
  /** When provided (and not `readOnly`), stars become keyboard-operable radio buttons. */
  onChange?: (v: number) => void;
  /** Force the static, non-interactive presentation even when `onChange` is set. */
  readOnly?: boolean;
  className?: string;
}

/** A single star glyph. Kept inline so the component stays dependency-free. */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg
      className={cx('lui-rating__star', filled ? 'lui-rating__star--filled' : null)}
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      aria-hidden
    >
      <path d="M12 2l2.9 6.26L21.6 9.2l-4.8 4.68 1.13 6.62L12 17.27 6.07 20.5l1.13-6.62L2.4 9.2l6.7-.94z" />
    </svg>
  );
}

/**
 * A star rating.
 *
 * - Interactive (`onChange` set and not `readOnly`): rendered as a `radiogroup` of `radio` buttons.
 *   Each star is a real `<button>`, so click and Space/Enter select it; ArrowLeft/ArrowRight and
 *   ArrowDown/ArrowUp decrement/increment within `[1, max]`.
 * - Static (default, or `readOnly`): a single element with an `aria-label` describing the value.
 */
export function Rating({ value, max = 5, onChange, readOnly, className }: RatingProps) {
  const interactive = !!onChange && !readOnly;
  const stars = Array.from({ length: max }, (_, i) => i + 1);
  const clamp = (v: number) => Math.max(1, Math.min(max, v));

  if (!interactive) {
    return (
      <span
        className={cx('lui-rating', className)}
        role="img"
        aria-label={`Rating: ${value} out of ${max}`}
      >
        {stars.map((star) => (
          <Star key={star} filled={star <= value} />
        ))}
      </span>
    );
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange!(clamp(value + 1));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange!(clamp(value - 1));
    }
  };

  return (
    <div
      className={cx('lui-rating', 'lui-rating--interactive', className)}
      role="radiogroup"
      aria-label="Rating"
      onKeyDown={handleKeyDown}
    >
      {stars.map((star) => {
        const selected = star === value;
        return (
          <button
            key={star}
            type="button"
            className="lui-rating__button"
            role="radio"
            aria-checked={selected}
            aria-label={`${star} ${star === 1 ? 'star' : 'stars'}`}
            // Only the selected star is a tab stop; arrows move within the group.
            tabIndex={selected || (value < 1 && star === 1) ? 0 : -1}
            onClick={() => onChange!(star)}
          >
            <Star filled={star <= value} />
          </button>
        );
      })}
    </div>
  );
}
