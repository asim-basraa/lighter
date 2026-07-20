// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SpecView } from './index.js';
import { previews } from './previews.js';
import { catalogDefs } from './catalog-defs.js';

afterEach(cleanup);

/**
 * The components exposed for the visual editor (#166). These went into the catalog because the
 * editor could otherwise only insert 24 components, 6 of which nest — which reads as "the editor is
 * limited" when the real constraint was the catalog.
 */
const EXPOSED = [
  'Box',
  'AspectRatio',
  'Image',
  'Field',
  'Input',
  'Textarea',
  'Select',
  'Checkbox',
  'Radio',
  'Switch',
];

describe('catalog exposure (#166)', () => {
  it('registers every newly exposed component', () => {
    const names = catalogDefs.map((d) => d.name);
    for (const name of EXPOSED) expect(names, name).toContain(name);
  });

  it('renders each one from its preview without throwing', () => {
    for (const name of EXPOSED) {
      const preview = previews[name];
      expect(preview, `${name} has no preview`).toBeTruthy();
      const { unmount } = render(<SpecView spec={preview!} />);
      unmount();
    }
  });

  it('renders form controls as UNCONTROLLED, so a spec with no handlers stays usable', () => {
    // A spec carries no event handlers (actions are #155). Controlled inputs would be un-typeable
    // for anyone clicking through the prototype — React would reset every keystroke. Assert the
    // behaviour rather than an attribute: typed input must survive.
    render(<SpecView spec={previews.Input!} />);
    const input = screen.getByPlaceholderText('Street address') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12 Bridge Street' } });
    expect(input.value).toBe('12 Bridge Street');
  });

  it('keeps a Select with a preset value changeable', () => {
    render(<SpecView spec={previews.Select!} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('standard'); // the spec's preset shows…
    fireEvent.change(select, { target: { value: 'express' } });
    expect(select.value).toBe('express'); // …but doesn't trap the user
  });

  it('renders Select options from the options prop', () => {
    render(<SpecView spec={previews.Select!} />);
    expect(screen.getByRole('option', { name: /standard/i })).toBeTruthy();
    expect(screen.getByRole('option', { name: /express/i })).toBeTruthy();
  });

  it('wires Field label and help text to its control', () => {
    render(<SpecView spec={previews.Field!} />);
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByText(/order updates/i)).toBeTruthy();
  });

  it('gives Stack the full spacing scale and alignment the component already supported', () => {
    const stack = catalogDefs.find((d) => d.name === 'Stack')!;
    const shape = stack.props as unknown as { shape: Record<string, unknown> };
    expect(Object.keys(shape.shape)).toEqual(
      expect.arrayContaining(['direction', 'gap', 'align', 'justify', 'wrap']),
    );
  });

  it('exposes Button loading/disabled, which a real button has and a spec could not express', () => {
    const button = catalogDefs.find((d) => d.name === 'Button')!;
    const shape = button.props as unknown as { shape: Record<string, unknown> };
    expect(Object.keys(shape.shape)).toEqual(
      expect.arrayContaining(['loading', 'disabled', 'block']),
    );
  });
});
