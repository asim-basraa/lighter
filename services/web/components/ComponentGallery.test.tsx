// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { ComponentGallery } from './ComponentGallery.js';
import type { InventoryComponent } from '../lib/inventory.js';

afterEach(cleanup);

const componentsFixture: InventoryComponent[] = [
  { name: 'Button', description: 'A clickable button.', slots: [], props: {} },
  { name: 'Card', description: 'A surface container.', slots: ['default'], props: {} },
  { name: 'Text', description: 'A paragraph of text.', slots: [], props: {} },
];

describe('ComponentGallery', () => {
  it('lists every cataloged component with its name and description', () => {
    render(<ComponentGallery components={componentsFixture} />);
    for (const c of componentsFixture) {
      expect(screen.getByRole('heading', { name: c.name })).toBeTruthy();
      expect(screen.getByText(c.description)).toBeTruthy();
    }
  });

  it('renders a live preview per component (the Button preview is a real button)', () => {
    render(<ComponentGallery components={componentsFixture} />);
    // The design system's Button preview renders a real <button> carrying its label.
    expect(screen.getByRole('button', { name: 'Click me' })).toBeTruthy();
  });

  it('renders a live preview scoped to its own card', () => {
    render(<ComponentGallery components={componentsFixture} />);
    const card = screen.getByRole('heading', { name: 'Card' }).closest('[data-component]');
    expect(card).toBeTruthy();
    // The Card preview renders its own title + body inside that card only.
    expect(within(card as HTMLElement).getByText(/card body copy/i)).toBeTruthy();
  });

  it('shows a no-preview note when a component ships no preview spec', () => {
    render(
      <ComponentGallery
        components={[{ name: 'Mystery', description: 'x', slots: [], props: {} }]}
      />,
    );
    expect(screen.getByText(/no preview/i)).toBeTruthy();
  });

  it('shows an empty state when there are no components', () => {
    render(<ComponentGallery components={[]} />);
    expect(screen.getByText(/no components/i)).toBeTruthy();
  });

  it('shows a per-component health badge from the findings for that component', () => {
    render(
      <ComponentGallery
        components={componentsFixture}
        health={[{ kind: 'missing-preview', target: 'Card', message: 'Card has no preview.' }]}
      />,
    );
    // Card has a finding → its card shows an issue count; Button (no findings) shows healthy.
    const cardEl = screen.getByRole('heading', { name: 'Card' }).closest('[data-component]')!;
    expect(within(cardEl as HTMLElement).getByText('1')).toBeTruthy();

    const buttonEl = screen.getByRole('heading', { name: 'Button' }).closest('[data-component]')!;
    expect(within(buttonEl as HTMLElement).getByText(/healthy/i)).toBeTruthy();
  });

  it('does not leak an orphaned-token finding onto a same-named component card', () => {
    render(
      <ComponentGallery
        components={componentsFixture}
        health={[{ kind: 'orphaned-token', target: 'Button', message: 'token unused' }]}
      />,
    );
    // Even though the token target matches a component name, the Button card stays healthy.
    const buttonEl = screen.getByRole('heading', { name: 'Button' }).closest('[data-component]')!;
    expect(within(buttonEl as HTMLElement).getByText(/healthy/i)).toBeTruthy();
  });
});
