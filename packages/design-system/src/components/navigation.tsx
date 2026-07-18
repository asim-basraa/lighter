'use client';

import {
  forwardRef,
  useId,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '../util/cx.js';

/**
 * @lighter/design-system navigation components — Tabs, Accordion, Breadcrumb, Pagination, Steps,
 * NavLink. These are the "moving between / within views" controls, so the file is a client component
 * (`'use client'`): Tabs and Accordion own local open/selected state and every control ships full
 * keyboard support per the relevant WAI-ARIA pattern.
 *
 * Class convention: root `lui-<name>`, modifier `lui-<name>--<variant>`, part `lui-<name>__<part>`.
 * All visual values live in navigation.css as design tokens.
 */

/* ------------------------------------------------------------------------------------------------
 * Tabs
 * ---------------------------------------------------------------------------------------------- */

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Initial selection for uncontrolled use. Ignored when `value` is provided. */
  defaultTab?: string;
  /** Selected tab id for controlled use. When set, the parent owns selection via `onChange`. */
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
}

/**
 * A tabbed interface following the WAI-ARIA tabs pattern with automatic activation: focusing a tab
 * with Left/Right/Home/End also selects it. Works controlled (`value` + `onChange`) or uncontrolled
 * (`defaultTab`). Roving tabindex keeps a single tab in the Tab order; arrow keys move between the
 * rest and skip disabled tabs. The active tab renders an animated underline indicator.
 */
export function Tabs({ tabs, defaultTab, value, onChange, className }: TabsProps) {
  // Fall back to the first non-disabled tab so there is always a sensible initial selection.
  const firstEnabled = tabs.find((tab) => !tab.disabled)?.id;
  const [internal, setInternal] = useState<string | undefined>(defaultTab ?? firstEnabled);

  // Controlled when `value` is supplied; otherwise we track selection internally.
  const isControlled = value !== undefined;
  const selected = isControlled ? value : internal;

  // Stable id prefix so each tab/panel pair can cross-reference via aria-controls / aria-labelledby.
  const baseId = useId();
  // One DOM ref per trigger so keyboard navigation can move real focus to the target tab.
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (id: string): void => {
    if (!isControlled) setInternal(id);
    onChange?.(id);
  };

  // Indices of tabs that can receive focus (enabled), used for arrow / Home / End navigation.
  const enabledIndices = tabs.reduce<number[]>((acc, tab, index) => {
    if (!tab.disabled) acc.push(index);
    return acc;
  }, []);

  const focusAndSelect = (index: number): void => {
    const tab = tabs[index];
    if (!tab) return;
    tabRefs.current[index]?.focus();
    select(tab.id);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number): void => {
    if (enabledIndices.length === 0) return;
    const pos = enabledIndices.indexOf(currentIndex);

    switch (event.key) {
      case 'ArrowRight': {
        event.preventDefault();
        // Wrap around the end so navigation is continuous, matching native tab strips.
        const next = enabledIndices[(pos + 1) % enabledIndices.length]!;
        focusAndSelect(next);
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        const prev = enabledIndices[(pos - 1 + enabledIndices.length) % enabledIndices.length]!;
        focusAndSelect(prev);
        break;
      }
      case 'Home':
        event.preventDefault();
        focusAndSelect(enabledIndices[0]!);
        break;
      case 'End':
        event.preventDefault();
        focusAndSelect(enabledIndices[enabledIndices.length - 1]!);
        break;
      default:
        break;
    }
  };

  return (
    <div className={cx('lui-tabs', className)}>
      <div role="tablist" className="lui-tabs__list">
        {tabs.map((tab, index) => {
          const isSelected = tab.id === selected;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              aria-selected={isSelected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              aria-disabled={tab.disabled || undefined}
              disabled={tab.disabled}
              // Roving tabindex: only the selected tab is tabbable; the rest are reached with arrows.
              tabIndex={isSelected ? 0 : -1}
              className={cx('lui-tabs__tab', isSelected ? 'lui-tabs__tab--active' : null)}
              onClick={() => !tab.disabled && select(tab.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const isSelected = tab.id === selected;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${baseId}-panel-${tab.id}`}
            aria-labelledby={`${baseId}-tab-${tab.id}`}
            // Panels stay mounted but hidden so panel state (forms, scroll) survives tab switches;
            // the panel is focusable so keyboard users can Tab straight from the tab into its content.
            hidden={!isSelected}
            tabIndex={0}
            className="lui-tabs__panel"
          >
            {isSelected && tab.content}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Accordion
 * ---------------------------------------------------------------------------------------------- */

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /** `single` keeps at most one panel open (closing others); `multiple` allows several. */
  type?: 'single' | 'multiple';
  /** Ids open on first render. */
  defaultOpen?: string[];
  className?: string;
}

/**
 * A vertical stack of collapsible sections. Each header is a real `<button aria-expanded>` that
 * toggles the region below it (`role="region"` labelled by the header). In `single` mode opening one
 * panel closes the others; `multiple` lets any number stay open. The chevron rotates when open.
 */
export function Accordion({ items, type = 'single', defaultOpen = [], className }: AccordionProps) {
  // Track open ids as a set-like array. `single` mode is normalised to at most one entry on toggle.
  const [open, setOpen] = useState<string[]>(defaultOpen);
  const baseId = useId();

  const isOpen = (id: string): boolean => open.includes(id);

  const toggle = (id: string): void => {
    setOpen((prev) => {
      if (prev.includes(id)) return prev.filter((openId) => openId !== id);
      // In single mode a newly-opened panel replaces the previous one.
      return type === 'single' ? [id] : [...prev, id];
    });
  };

  return (
    <div className={cx('lui-accordion', className)}>
      {items.map((item) => {
        const expanded = isOpen(item.id);
        const headerId = `${baseId}-header-${item.id}`;
        const regionId = `${baseId}-region-${item.id}`;
        return (
          <div
            key={item.id}
            className={cx('lui-accordion__item', expanded ? 'lui-accordion__item--open' : null)}
          >
            <h3 className="lui-accordion__heading">
              <button
                type="button"
                id={headerId}
                className="lui-accordion__trigger"
                aria-expanded={expanded}
                aria-controls={regionId}
                onClick={() => toggle(item.id)}
              >
                <span className="lui-accordion__title">{item.title}</span>
                {/* aria-hidden: the expanded state is already conveyed by aria-expanded above. */}
                <span className="lui-accordion__chevron" aria-hidden="true" />
              </button>
            </h3>
            <div
              id={regionId}
              role="region"
              aria-labelledby={headerId}
              hidden={!expanded}
              className="lui-accordion__panel"
            >
              <div className="lui-accordion__content">{item.content}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Breadcrumb
 * ---------------------------------------------------------------------------------------------- */

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * A trail of links showing the current location in a hierarchy. Rendered as `<nav>` + an ordered
 * list (order is meaningful). The final item is marked `aria-current="page"` and rendered as plain
 * text rather than a link, since it points at the current page. `/` separators sit between items and
 * are hidden from assistive tech.
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cx('lui-breadcrumb', className)}>
      <ol className="lui-breadcrumb__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="lui-breadcrumb__item">
              {item.href != null && !isLast ? (
                <a href={item.href} className="lui-breadcrumb__link">
                  {item.label}
                </a>
              ) : (
                <span
                  className="lui-breadcrumb__current"
                  // Only the trailing crumb is the current page.
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
              {!isLast && (
                <span className="lui-breadcrumb__separator" aria-hidden="true">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Pagination
 * ---------------------------------------------------------------------------------------------- */

export interface PaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** How many page numbers to show either side of the current page. Defaults to 1. */
  siblingCount?: number;
  className?: string;
}

// Sentinel for a gap that should render as an ellipsis rather than a page button.
const ELLIPSIS = 'ellipsis' as const;
type PageEntry = number | typeof ELLIPSIS;

/** Inclusive integer range [start, end]. */
function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i += 1) out.push(i);
  return out;
}

/**
 * Build the list of page entries to render: always the first and last page, a window of
 * `siblingCount` around the current page, and `ellipsis` sentinels for any gaps. Falls back to a
 * plain range when everything fits without needing ellipses.
 */
function buildPages(page: number, pageCount: number, siblingCount: number): PageEntry[] {
  // First + last + current + 2 siblings + 2 ellipses. If we can show every page, just do that.
  const totalSlots = siblingCount * 2 + 5;
  if (pageCount <= totalSlots) return range(1, pageCount);

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, pageCount);

  // Only show an ellipsis when it hides at least one page (i.e. there's a real gap to the ends).
  const showLeftEllipsis = leftSibling > 2;
  const showRightEllipsis = rightSibling < pageCount - 1;

  const pages: PageEntry[] = [1];
  if (showLeftEllipsis) {
    pages.push(ELLIPSIS);
  } else {
    // No gap on the left — fill in the pages between the first page and the window.
    pages.push(...range(2, leftSibling - 1));
  }

  pages.push(...range(leftSibling, rightSibling).filter((p) => p !== 1 && p !== pageCount));

  if (showRightEllipsis) {
    pages.push(ELLIPSIS);
  } else {
    pages.push(...range(rightSibling + 1, pageCount - 1));
  }
  pages.push(pageCount);

  return pages;
}

/**
 * Numbered page navigation with Prev/Next controls and ellipses for large ranges. Rendered as a
 * `<nav>` so it is exposed as a landmark. The current page carries `aria-current="page"`; Prev is
 * disabled on the first page and Next on the last. Guards against out-of-range clicks internally.
 */
export function Pagination({
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  className,
}: PaginationProps) {
  if (pageCount <= 0) return null;

  const pages = buildPages(page, pageCount, siblingCount);
  const goTo = (target: number): void => {
    // Clamp so Prev/Next and any programmatic entry can never step outside [1, pageCount].
    const clamped = Math.min(Math.max(target, 1), pageCount);
    if (clamped !== page) onPageChange(clamped);
  };

  const atStart = page <= 1;
  const atEnd = page >= pageCount;

  return (
    <nav aria-label="Pagination" className={cx('lui-pagination', className)}>
      <ul className="lui-pagination__list">
        <li>
          <button
            type="button"
            className="lui-pagination__control"
            aria-label="Go to previous page"
            disabled={atStart}
            onClick={() => goTo(page - 1)}
          >
            {'‹'}
          </button>
        </li>
        {pages.map((entry, index) =>
          entry === ELLIPSIS ? (
            <li key={`ellipsis-${index}`} className="lui-pagination__ellipsis" aria-hidden="true">
              {'…'}
            </li>
          ) : (
            <li key={entry}>
              <button
                type="button"
                className={cx(
                  'lui-pagination__page',
                  entry === page ? 'lui-pagination__page--active' : null,
                )}
                aria-label={`Go to page ${entry}`}
                aria-current={entry === page ? 'page' : undefined}
                onClick={() => goTo(entry)}
              >
                {entry}
              </button>
            </li>
          ),
        )}
        <li>
          <button
            type="button"
            className="lui-pagination__control"
            aria-label="Go to next page"
            disabled={atEnd}
            onClick={() => goTo(page + 1)}
          >
            {'›'}
          </button>
        </li>
      </ul>
    </nav>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Steps (Stepper)
 * ---------------------------------------------------------------------------------------------- */

export interface StepItem {
  label: ReactNode;
  description?: ReactNode;
}

export interface StepsProps {
  steps: StepItem[];
  /** Zero-based index of the active step. Earlier steps render as completed. */
  current: number;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/**
 * A progress indicator for multi-step flows. Steps before `current` render as completed (check
 * mark), `current` is highlighted (and marked `aria-current="step"`), and later steps are upcoming.
 * A connector line runs between markers. Presented as an ordered list since step order is meaningful.
 */
export function Steps({ steps, current, orientation = 'horizontal', className }: StepsProps) {
  return (
    <ol className={cx('lui-steps', `lui-steps--${orientation}`, className)}>
      {steps.map((step, index) => {
        const completed = index < current;
        const active = index === current;
        // Derive a single status token for both styling hooks and the marker glyph.
        const status = completed ? 'complete' : active ? 'current' : 'upcoming';
        return (
          <li
            key={index}
            className={cx('lui-steps__item', `lui-steps__item--${status}`)}
            aria-current={active ? 'step' : undefined}
          >
            {/* Connector sits behind the marker; the first step hides it via CSS (:first-child). */}
            <span className="lui-steps__connector" aria-hidden="true" />
            <span className="lui-steps__marker" aria-hidden="true">
              {completed ? '✓' : index + 1}
            </span>
            <span className="lui-steps__body">
              <span className="lui-steps__label">{step.label}</span>
              {step.description != null && (
                <span className="lui-steps__description">{step.description}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------------------------------------
 * NavLink
 * ---------------------------------------------------------------------------------------------- */

export interface NavLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  /** Marks the link as representing the current location (styling + `aria-current="page"`). */
  active?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * A styled anchor for sidebars and navbars. When `active`, it takes the active treatment and is
 * marked `aria-current="page"` so assistive tech announces the current location. Forwards its ref
 * and any extra anchor attributes, so it composes with router `<Link asChild>`-style wrappers.
 */
export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { href, active, children, className, ...rest },
  ref,
) {
  return (
    <a
      ref={ref}
      href={href}
      className={cx('lui-nav-link', active ? 'lui-nav-link--active' : null, className)}
      aria-current={active ? 'page' : undefined}
      {...rest}
    >
      {children}
    </a>
  );
});
