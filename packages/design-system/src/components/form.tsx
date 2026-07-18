import {
  forwardRef,
  useId,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from '../util/cx.js';
import { Label } from './typography.js';

type Size = 'sm' | 'md' | 'lg';

/** A single-line text input. Set `invalid` to show the error state; pair with `<Field>`. */
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { size?: Size; invalid?: boolean }
>(function Input({ size = 'md', invalid, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cx('lui-input', `lui-input--${size}`, className)}
      {...rest}
    />
  );
});

/** A multi-line text input. */
export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(function Textarea({ invalid, className, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cx('lui-input', 'lui-textarea', className)}
      {...rest}
    />
  );
});

/** A native select. Provide `<option>`s as children. */
export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { size?: Size; invalid?: boolean }
>(function Select({ size = 'md', invalid, className, children, ...rest }, ref) {
  return (
    <div className="lui-select-wrap">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cx('lui-input', 'lui-select', `lui-input--${size}`, className)}
        {...rest}
      >
        {children}
      </select>
      <span className="lui-select__chevron" aria-hidden>
        ▾
      </span>
    </div>
  );
});

/** A checkbox with an inline label. */
export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: ReactNode }
>(function Checkbox({ label, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <span className={cx('lui-choice', className)}>
      <input ref={ref} id={inputId} type="checkbox" className="lui-checkbox" {...rest} />
      {label != null && (
        <label htmlFor={inputId} className="lui-choice__label">
          {label}
        </label>
      )}
    </span>
  );
});

/** A radio button with an inline label. Use within a `<RadioGroup>` (shared `name`). */
export const Radio = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: ReactNode }
>(function Radio({ label, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <span className={cx('lui-choice', className)}>
      <input ref={ref} id={inputId} type="radio" className="lui-radio" {...rest} />
      {label != null && (
        <label htmlFor={inputId} className="lui-choice__label">
          {label}
        </label>
      )}
    </span>
  );
});

/** Groups radios and renders them in a column or row. */
export function RadioGroup({
  name,
  orientation = 'vertical',
  className,
  children,
}: {
  name?: string;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="radiogroup"
      data-name={name}
      className={cx('lui-radio-group', `lui-radio-group--${orientation}`, className)}
    >
      {children}
    </div>
  );
}

/** An on/off toggle. */
export const Switch = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: ReactNode }
>(function Switch({ label, className, id, ...rest }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <span className={cx('lui-choice', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        className="lui-switch"
        {...rest}
      />
      {label != null && (
        <label htmlFor={inputId} className="lui-choice__label">
          {label}
        </label>
      )}
    </span>
  );
});

/** A range slider. */
export const Slider = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(function Slider({ className, ...rest }, ref) {
  return <input ref={ref} type="range" className={cx('lui-slider', className)} {...rest} />;
});

/**
 * A labelled form field: label + control + optional help / error text, wired with `htmlFor`/`aria`.
 * Pass the control as children; when `error` is set it renders the invalid state message.
 */
export function Field({
  label,
  required,
  help,
  error,
  htmlFor,
  className,
  style,
  children,
}: {
  label?: ReactNode;
  required?: boolean;
  help?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div className={cx('lui-field', error ? 'lui-field--invalid' : null, className)} style={style}>
      {label != null && (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error != null ? (
        <p className="lui-field__error" role="alert">
          {error}
        </p>
      ) : help != null ? (
        <p className="lui-field__help">{help}</p>
      ) : null}
    </div>
  );
}

/** A grouped set of fields with an optional legend. */
export function Fieldset({
  legend,
  className,
  children,
}: {
  legend?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <fieldset className={cx('lui-fieldset', className)}>
      {legend != null && <legend className="lui-fieldset__legend">{legend}</legend>}
      {children}
    </fieldset>
  );
}
