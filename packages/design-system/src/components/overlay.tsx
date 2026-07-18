'use client';

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../util/cx.js';

/**
 * Overlay primitives — Dialog, AlertDialog, Drawer, Popover, DropdownMenu, Tooltip.
 *
 * These are the interactive, "escapes the layout" components, so the file is a client component
 * (`'use client'`) and everything is controlled via `open` + an explicit `onClose`/`onOpenChange`
 * — leaving open/close policy to the caller keeps the primitives composable and avoids hidden state
 * that fights app-level routing or form logic.
 */

/* ------------------------------------------------------------------------------------------------
 * Shared internals
 * ---------------------------------------------------------------------------------------------- */

/**
 * Selector for the elements a focus trap must cycle through. We exclude `tabindex="-1"` because
 * those are programmatically-focusable-only (like the dialog panel itself) and must never be part
 * of the Tab ring.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Collect the currently focusable descendants, skipping anything hidden (no layout box). */
function getFocusable(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    // `offsetParent === null` catches `display:none` ancestors; keep the active element regardless
    // so a focused-but-technically-hidden element doesn't get dropped mid-interaction.
    (el) => el.offsetParent !== null || el === document.activeElement,
  );
}

/**
 * Runs an effect only after the component has mounted on the client. Portals must be guarded this
 * way: `document` does not exist during SSR, and rendering the portal on the first client render
 * (before hydration settles) risks a mismatch — so we render nothing until mounted.
 */
function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

// Module-level ref-count so that stacked/overlapping dialogs don't prematurely release the lock:
// the body only regains its scroll when the *last* open overlay unlocks.
let scrollLockCount = 0;
let scrollLockPrevOverflow = '';

/** Freeze background scroll while an overlay is open, restoring the prior value when all release. */
function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    if (scrollLockCount === 0) {
      scrollLockPrevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLockCount += 1;
    return () => {
      scrollLockCount -= 1;
      if (scrollLockCount === 0) document.body.style.overflow = scrollLockPrevOverflow;
    };
  }, [locked]);
}

/**
 * Full modal behaviour for Dialog/AlertDialog/Drawer: move focus into the panel on open, trap Tab
 * within it, close on Escape, and restore focus to the previously-focused element on close. This is
 * the accessibility contract for `aria-modal` surfaces — keyboard users must never Tab "behind" the
 * modal, and focus must return to where they were when it closes.
 */
function useModalFocus(
  active: boolean,
  panelRef: RefObject<HTMLElement>,
  onEscape: () => void,
): void {
  // Keep the latest onEscape without re-subscribing the listener on every render.
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return;

    // Remember what to restore to *before* we steal focus for the panel.
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the panel itself (tabIndex=-1) so the very next Tab lands on the first control and
    // screen readers announce the dialog's accessible name.
    panel?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        // Stop propagation so a single Escape closes only the topmost overlay, not a parent one too.
        event.stopPropagation();
        onEscapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = getFocusable(panel);
      if (focusables.length === 0) {
        // Nothing to focus inside — keep focus pinned to the panel rather than escaping the modal.
        event.preventDefault();
        panel?.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;

      if (event.shiftKey) {
        if (activeEl === first || activeEl === panel) {
          event.preventDefault();
          last?.focus();
        }
      } else if (activeEl === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Restore focus so keyboard/AT users continue from where they opened the modal.
      previouslyFocused?.focus?.();
    };
  }, [active, panelRef]);
}

/** Close a lightweight popup on outside pointerdown or Escape (Popover/DropdownMenu). */
function useDismissable(open: boolean, rootRef: RefObject<HTMLElement>, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent): void {
      // `mousedown` (not `click`) so we dismiss before the target handles the press, matching
      // native menu/popover feel and avoiding a flash when clicking straight through.
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        onCloseRef.current();
      }
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCloseRef.current();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, rootRef]);
}

/* ------------------------------------------------------------------------------------------------
 * Dialog (Modal)
 * ---------------------------------------------------------------------------------------------- */

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * A centered modal dialog rendered over a backdrop. Portalled to `document.body` so it is never
 * clipped by an ancestor's `overflow`/`transform` and always stacks above app content. Closes on
 * Escape and backdrop click; traps focus while open.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  className,
  style,
  children,
}: DialogProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useScrollLock(open);
  useModalFocus(open, panelRef, onClose);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="lui-overlay lui-overlay--center">
      {/* Backdrop is its own element behind the panel so a click on the panel never bubbles to it. */}
      <div className="lui-overlay__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title != null ? titleId : undefined}
        aria-describedby={description != null ? descId : undefined}
        tabIndex={-1}
        className={cx('lui-dialog', `lui-dialog--${size}`, className)}
        style={style}
      >
        {(title != null || description != null) && (
          <div className="lui-dialog__header">
            {title != null && (
              <h2 id={titleId} className="lui-dialog__title">
                {title}
              </h2>
            )}
            {description != null && (
              <p id={descId} className="lui-dialog__description">
                {description}
              </p>
            )}
          </div>
        )}
        {children != null && <div className="lui-dialog__body">{children}</div>}
        {footer != null && <div className="lui-dialog__footer">{footer}</div>}
        <button
          type="button"
          className="lui-dialog__close"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ×
        </button>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------------------------------------
 * AlertDialog
 * ---------------------------------------------------------------------------------------------- */

export interface AlertDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  tone?: 'default' | 'destructive';
  className?: string;
  style?: CSSProperties;
}

/**
 * A confirmation dialog (`role="alertdialog"`) with explicit Cancel + Confirm actions. Unlike
 * Dialog it deliberately does NOT close on backdrop click — a destructive/irreversible choice should
 * require a real decision, not an accidental dismiss. Escape still cancels (a safe default).
 */
export function AlertDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  tone = 'default',
  className,
  style,
}: AlertDialogProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descId = useId();

  useScrollLock(open);
  // Escape maps to Cancel — the non-destructive path is always the safe key-driven default.
  useModalFocus(open, panelRef, onClose);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="lui-overlay lui-overlay--center">
      {/* No onClick here: backdrop clicks are intentionally inert for confirmations. */}
      <div className="lui-overlay__backdrop" aria-hidden="true" />
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description != null ? descId : undefined}
        tabIndex={-1}
        className={cx('lui-dialog', 'lui-dialog--sm', 'lui-alert-dialog', className)}
        style={style}
      >
        <div className="lui-dialog__header">
          <h2 id={titleId} className="lui-dialog__title">
            {title}
          </h2>
          {description != null && (
            <p id={descId} className="lui-dialog__description">
              {description}
            </p>
          )}
        </div>
        <div className="lui-alert-dialog__actions">
          {/* Replicate the Button component's classes rather than importing it, keeping this file
              dependency-free of other components per the library's layering rules. */}
          <button
            type="button"
            className="lui-button lui-button--md lui-button--secondary"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={cx(
              'lui-button',
              'lui-button--md',
              tone === 'destructive' ? 'lui-button--destructive' : 'lui-button--primary',
            )}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------------------------------------
 * Drawer (Sheet)
 * ---------------------------------------------------------------------------------------------- */

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: 'right' | 'left' | 'top' | 'bottom';
  title?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * A panel that slides in from a screen edge (a.k.a. Sheet). Shares Dialog's modal semantics —
 * portal, backdrop-to-close, Escape, focus trap, scroll lock — but anchors to `side` instead of
 * centering. Good for navigation, filters, and detail panes.
 */
export function Drawer({
  open,
  onClose,
  side = 'right',
  title,
  className,
  style,
  children,
}: DrawerProps) {
  const mounted = useMounted();
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useScrollLock(open);
  useModalFocus(open, panelRef, onClose);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="lui-overlay">
      <div className="lui-overlay__backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title != null ? titleId : undefined}
        tabIndex={-1}
        className={cx('lui-drawer', `lui-drawer--${side}`, className)}
        style={style}
      >
        {title != null && (
          <div className="lui-drawer__header">
            <h2 id={titleId} className="lui-drawer__title">
              {title}
            </h2>
            <button
              type="button"
              className="lui-drawer__close"
              aria-label="Close"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        )}
        <div className="lui-drawer__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------------------------------------
 * Popover
 * ---------------------------------------------------------------------------------------------- */

export interface PopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * A click-toggled floating panel anchored below its trigger. Positioned purely with CSS relative to
 * a wrapper (no positioning library) — fine for the common "attached to a button" case. Dismisses on
 * outside click or Escape. The trigger is wrapped in a real `<button>` so it is keyboard- and
 * AT-operable and can carry `aria-expanded`; pass non-interactive content (text/icon) as `trigger`.
 */
export function Popover({ trigger, children, align = 'center', className }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useDismissable(open, rootRef, () => setOpen(false));

  return (
    <span ref={rootRef} className={cx('lui-popover', className)}>
      <button
        type="button"
        className="lui-popover__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((prev) => !prev)}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          className={cx('lui-popover__panel', `lui-popover__panel--${align}`)}
        >
          {children}
        </div>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------
 * DropdownMenu
 * ---------------------------------------------------------------------------------------------- */

export interface DropdownMenuItemOption {
  label: ReactNode;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
}
export interface DropdownMenuSeparator {
  separator: true;
}
export type DropdownMenuEntry = DropdownMenuItemOption | DropdownMenuSeparator;

export interface DropdownMenuProps {
  trigger: ReactNode;
  items: DropdownMenuEntry[];
  className?: string;
}

const isSeparator = (entry: DropdownMenuEntry): entry is DropdownMenuSeparator =>
  'separator' in entry;

/**
 * An accessible menu (`role="menu"`) opened by its trigger, with full keyboard support: Up/Down move
 * roving focus between enabled items (skipping separators and disabled entries), Enter/Space select,
 * Escape closes and returns focus to the trigger, and an outside click dismisses. Arrow navigation is
 * the WAI-ARIA menu pattern users expect, so we implement it rather than relying on Tab.
 */
export function DropdownMenu({ trigger, items, className }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // One DOM ref per rendered menuitem so we can move real focus as the active index changes.
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  // Indices of entries that can actually receive focus (not separators, not disabled).
  const enabledIndices = items.reduce<number[]>((acc, entry, index) => {
    if (!isSeparator(entry) && !entry.disabled) acc.push(index);
    return acc;
  }, []);

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    setActiveIndex(-1);
    // Return focus to the trigger after a keyboard-driven close so the tab order stays coherent.
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useDismissable(open, rootRef, () => close(false));

  // When the active index changes (open, or arrow navigation), move real DOM focus to that item.
  useEffect(() => {
    if (open && activeIndex >= 0) itemRefs.current[activeIndex]?.focus();
  }, [open, activeIndex]);

  const openMenu = useCallback(
    (toLast: boolean) => {
      setOpen(true);
      const target = toLast ? enabledIndices[enabledIndices.length - 1] : enabledIndices[0];
      setActiveIndex(target ?? -1);
    },
    [enabledIndices],
  );

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    // ArrowDown/Up (and Enter/Space) open the menu, landing on the first/last item respectively.
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openMenu(false);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenu(true);
    }
  }

  function moveActive(direction: 1 | -1): void {
    if (enabledIndices.length === 0) return;
    const currentPos = enabledIndices.indexOf(activeIndex);
    // Wrap around the ends so navigation is continuous, matching native menus.
    const nextPos = (currentPos + direction + enabledIndices.length) % enabledIndices.length;
    setActiveIndex(enabledIndices[nextPos]!);
  }

  function selectItem(entry: DropdownMenuItemOption): void {
    if (entry.disabled) return;
    entry.onSelect?.();
    close(true);
  }

  function onMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(enabledIndices[0] ?? -1);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(enabledIndices[enabledIndices.length - 1] ?? -1);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const entry = items[activeIndex];
        if (entry && !isSeparator(entry)) selectItem(entry);
        break;
      }
      default:
        break;
    }
  }

  return (
    <span ref={rootRef} className={cx('lui-dropdown', className)}>
      <button
        ref={triggerRef}
        type="button"
        className="lui-dropdown__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openMenu(false))}
        onKeyDown={onTriggerKeyDown}
      >
        {trigger}
      </button>
      {open && (
        <div id={menuId} role="menu" className="lui-dropdown__menu" onKeyDown={onMenuKeyDown}>
          {items.map((entry, index) => {
            if (isSeparator(entry)) {
              return <div key={index} role="separator" className="lui-dropdown__separator" />;
            }
            return (
              <button
                key={index}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitem"
                className={cx(
                  'lui-dropdown__item',
                  entry.danger ? 'lui-dropdown__item--danger' : null,
                )}
                disabled={entry.disabled}
                // Roving tabindex: only the active item is in the Tab order; the rest are reachable
                // via arrow keys, per the ARIA menu pattern.
                tabIndex={activeIndex === index ? 0 : -1}
                onClick={() => selectItem(entry)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Tooltip
 * ---------------------------------------------------------------------------------------------- */

export interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay in ms before the tooltip appears on hover. Defaults to 300ms. */
  delay?: number;
  className?: string;
}

/**
 * A hover/focus tooltip (`role="tooltip"`). A short open delay avoids flicker as the pointer passes
 * over; focus shows it immediately since keyboard users get no hover intent. The single child is
 * cloned to receive `aria-describedby` so assistive tech associates the label with the actual
 * control, while the wrapper carries the pointer/focus handlers.
 */
export function Tooltip({ label, children, side = 'top', delay = 300, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  // Numeric handle from window.setTimeout; typed loosely to stay DOM/Node agnostic.
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setOpen(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }, []);

  // Clear any pending timer on unmount so we never call setState on a gone component.
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  // Associate the label with the child control for screen readers when a real element is passed.
  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, {
        'aria-describedby': open ? tooltipId : undefined,
      })
    : children;

  return (
    <span
      className={cx('lui-tooltip', className)}
      // focusin/focusout bubble, so onFocus/onBlur on the wrapper fire for the focusable child.
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={() => setOpen(true)}
      onBlur={hide}
    >
      {child}
      {open && (
        <span
          role="tooltip"
          id={tooltipId}
          className={cx('lui-tooltip__content', `lui-tooltip__content--${side}`)}
        >
          {label}
        </span>
      )}
    </span>
  );
}
