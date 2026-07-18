// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Button } from './button.js';
import { Card, Badge, Avatar, Progress } from './data-display.js';
import { Field, Input, Checkbox } from './form.js';
import { Alert } from './feedback.js';
import { Heading } from './typography.js';

afterEach(cleanup);

describe('Button', () => {
  it('renders a clickable button and fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and shows a spinner while loading', () => {
    render(<Button loading>Save</Button>);
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('data display', () => {
  it('Card renders a title and body', () => {
    render(<Card title="Summary">1 item</Card>);
    expect(screen.getByText('Summary')).toBeTruthy();
    expect(screen.getByText('1 item')).toBeTruthy();
  });

  it('Badge renders its label with tone/variant classes', () => {
    render(
      <Badge tone="success" variant="solid">
        Live
      </Badge>,
    );
    const badge = screen.getByText('Live');
    expect(badge.className).toContain('lui-badge--success');
    expect(badge.className).toContain('lui-badge--solid');
  });

  it('Avatar falls back to initials', () => {
    render(<Avatar name="Dana Ray" />);
    expect(screen.getByText('DR')).toBeTruthy();
  });

  it('Progress exposes an accessible value', () => {
    render(<Progress value={42} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('42');
  });
});

describe('forms', () => {
  it('Field wires the label to the control and shows an error', () => {
    render(
      <Field label="Email" htmlFor="email" error="Required">
        <Input id="email" invalid />
      </Field>,
    );
    expect(screen.getByText('Email')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Required');
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });

  it('Checkbox associates its label', () => {
    render(<Checkbox label="Accept" />);
    const box = screen.getByLabelText('Accept') as HTMLInputElement;
    expect(box.type).toBe('checkbox');
  });
});

describe('feedback + typography', () => {
  it('Alert has role=alert and its status class', () => {
    render(
      <Alert status="warning" title="Heads up">
        Careful
      </Alert>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('lui-alert--warning');
    expect(alert.textContent).toContain('Heads up');
  });

  it('Heading renders the right tag for its level', () => {
    render(<Heading level={3}>Section</Heading>);
    expect(screen.getByRole('heading', { level: 3, name: 'Section' })).toBeTruthy();
  });
});
