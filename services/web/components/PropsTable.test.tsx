// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { PropsTable } from './PropsTable.js';

afterEach(cleanup);

const buttonProps = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    variant: { anyOf: [{ type: 'string', enum: ['primary', 'secondary'] }, { type: 'null' }] },
  },
  required: ['label', 'variant'],
};

describe('PropsTable', () => {
  it('renders a row per prop with name, type, required and default columns', () => {
    render(<PropsTable props={buttonProps} />);
    const labelRow = screen.getByText('label').closest('tr') as HTMLElement;
    expect(within(labelRow).getByText('string')).toBeTruthy();
    // label is required
    expect(within(labelRow).getByText(/^(yes|required)$/i)).toBeTruthy();

    const variantRow = screen.getByText('variant').closest('tr') as HTMLElement;
    expect(within(variantRow).getByText('"primary" | "secondary" | null')).toBeTruthy();
  });

  it('has a header row naming the four columns', () => {
    render(<PropsTable props={buttonProps} />);
    for (const col of [/prop|name/i, /type/i, /required/i, /default/i]) {
      expect(screen.getByRole('columnheader', { name: col })).toBeTruthy();
    }
  });

  it('shows an empty note for a component with no props', () => {
    render(<PropsTable props={{ type: 'object' }} />);
    expect(screen.getByText(/no props/i)).toBeTruthy();
  });
});
