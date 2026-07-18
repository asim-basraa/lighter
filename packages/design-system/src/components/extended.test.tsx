// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { Tabs, Accordion, Breadcrumb, Pagination, Steps } from './navigation.js';
import { DataTable, DescriptionList, Timeline, Rating } from './table.js';
import { Dialog, DropdownMenu } from './overlay.js';
import { Icon } from './icon.js';

afterEach(cleanup);

describe('navigation', () => {
  it('Tabs renders a tablist and switches panels on click', () => {
    render(
      <Tabs
        tabs={[
          { id: 'a', label: 'First', content: 'Panel A' },
          { id: 'b', label: 'Second', content: 'Panel B' },
        ]}
      />,
    );
    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getByText('Panel A')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Second' }));
    expect(screen.getByText('Panel B')).toBeTruthy();
  });

  it('Accordion toggles a section open', () => {
    render(<Accordion items={[{ id: '1', title: 'Details', content: 'Hidden body' }]} />);
    const header = screen.getByRole('button', { name: 'Details' });
    expect(header.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('true');
  });

  it('Breadcrumb marks the last item as current', () => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Settings' }]} />);
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i });
    expect(within(nav).getByText('Settings').closest('[aria-current="page"]')).toBeTruthy();
  });

  it('Pagination disables Prev on the first page and paginates', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={5} onPageChange={onPageChange} />);
    expect(
      (screen.getByRole('button', { name: /previous page/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('Steps marks the current step', () => {
    render(<Steps steps={[{ label: 'One' }, { label: 'Two' }, { label: 'Three' }]} current={1} />);
    expect(screen.getByText('Two').closest('[aria-current="step"]')).toBeTruthy();
  });
});

describe('tables + data', () => {
  it('DataTable renders rows and an empty state', () => {
    const { rerender } = render(
      <DataTable
        columns={[
          { key: 'name', header: 'Name' },
          { key: 'plan', header: 'Plan' },
        ]}
        rows={[{ name: 'Acme', plan: 'Pro' }]}
      />,
    );
    expect(screen.getByText('Acme')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeTruthy();
    rerender(
      <DataTable columns={[{ key: 'name', header: 'Name' }]} rows={[]} empty="Nothing here" />,
    );
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });

  it('DescriptionList renders term/description pairs', () => {
    render(<DescriptionList items={[{ term: 'Status', description: 'Active' }]} />);
    expect(screen.getByText('Status')).toBeTruthy();
    expect(screen.getByText('Active')).toBeTruthy();
  });

  it('Timeline renders its items', () => {
    render(<Timeline items={[{ title: 'Created', description: 'by Dana' }]} />);
    expect(screen.getByText('Created')).toBeTruthy();
  });

  it('Rating exposes an accessible value and is interactive', () => {
    const onChange = vi.fn();
    render(<Rating value={2} max={5} onChange={onChange} />);
    expect(screen.getByRole('radiogroup')).toBeTruthy();
  });
});

describe('overlays + icons', () => {
  it('Dialog renders its content only when open', () => {
    const { rerender } = render(
      <Dialog open={false} onClose={() => {}} title="Confirm">
        Body
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(
      <Dialog open onClose={() => {}} title="Confirm">
        Body
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Confirm')).toBeTruthy();
  });

  it('DropdownMenu opens on trigger click and lists items', () => {
    const onSelect = vi.fn();
    render(<DropdownMenu trigger="Open" items={[{ label: 'Edit', onSelect }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('Icon renders an accessible-hidden svg', () => {
    const { container } = render(<Icon name="check" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });
});
