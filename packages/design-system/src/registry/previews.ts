import type { PreviewSpec } from './index.js';

/**
 * A preview spec per cataloged component: a minimal json-render spec (flat `root` + `elements`) that
 * renders the component in isolation. Lighter's inventory gallery renders these for a live preview,
 * and they double as render fixtures. Each preview is rooted at its own component so the gallery card
 * shows that component and nothing else.
 *
 * Keep one entry per catalog component — the build emits `previews: Object.keys(previews)` into
 * catalog.json, which is what drives the `missing-preview` health check.
 */

/** Small helper so a preview reads as a literal tree instead of hand-numbered element ids. */
type Node = { type: string; props?: Record<string, unknown>; children?: Node[] };
function spec(root: Node): PreviewSpec {
  const elements: Record<
    string,
    { type: string; props: Record<string, unknown>; children?: string[] }
  > = {};
  let n = 0;
  const walk = (node: Node): string => {
    const id = `el-${n++}`;
    // Reserve the id before recursing so children get later ids (pre-order, stable).
    elements[id] = { type: node.type, props: node.props ?? {}, children: undefined };
    const kids = (node.children ?? []).map(walk);
    if (kids.length) elements[id]!.children = kids;
    return id;
  };
  const rootId = walk(root);
  return { root: rootId, elements } as PreviewSpec;
}

const text = (content: string, props: Record<string, unknown> = {}): Node => ({
  type: 'Text',
  props: { content, ...props },
});

export const previews: Record<string, PreviewSpec> = {
  // Layout
  PageShell: spec({
    type: 'PageShell',
    props: { title: 'Dashboard' },
    children: [text('Content inside the page shell.', { tone: 'muted' })],
  }),
  Container: spec({
    type: 'Container',
    props: { size: 'md' },
    children: [text('Centred, width-constrained content.')],
  }),
  Stack: spec({
    type: 'Stack',
    props: { direction: 'vertical', gap: '2' },
    children: [text('First'), text('Second')],
  }),
  Grid: spec({
    type: 'Grid',
    props: { columns: 2, gap: '3' },
    children: [text('Column one'), text('Column two')],
  }),
  Divider: spec({ type: 'Divider', props: { orientation: 'horizontal' } }),

  // Typography
  Heading: spec({ type: 'Heading', props: { content: 'Section heading', level: 2 } }),
  Text: spec({
    type: 'Text',
    props: { content: 'Body copy in the default tone.', variant: 'body' },
  }),
  Link: spec({ type: 'Link', props: { label: 'Read the docs', href: '#' } }),

  // Surfaces + actions
  Card: spec({
    type: 'Card',
    props: { title: 'Card title' },
    children: [text('Card body copy.', { tone: 'muted' })],
  }),
  Button: spec({ type: 'Button', props: { label: 'Click me', variant: 'primary' } }),
  Badge: spec({ type: 'Badge', props: { label: 'New', tone: 'primary', variant: 'soft' } }),
  Avatar: spec({ type: 'Avatar', props: { name: 'Ada Lovelace', size: 'md' } }),

  // Data display
  Progress: spec({ type: 'Progress', props: { value: 64, tone: 'primary' } }),
  Stat: spec({ type: 'Stat', props: { label: 'Revenue', value: '$12,480', hint: '+12% MoM' } }),
  DescriptionList: spec({
    type: 'DescriptionList',
    props: {
      items: [
        { term: 'Plan', description: 'Pro' },
        { term: 'Seats', description: '12' },
      ],
    },
  }),
  Timeline: spec({
    type: 'Timeline',
    props: {
      items: [
        { title: 'Created', description: 'Draft saved', tone: 'default' },
        { title: 'Shared', description: 'Sent for review', tone: 'primary' },
      ],
    },
  }),

  // Feedback
  Alert: spec({
    type: 'Alert',
    props: { status: 'info', title: 'Heads up', message: 'This version is a prototype.' },
  }),
  Callout: spec({
    type: 'Callout',
    props: { status: 'success', title: 'Approved' },
    children: [text('All parties have signed off.')],
  }),
  EmptyState: spec({
    type: 'EmptyState',
    props: { title: 'No screens yet', description: 'Create your first screen to get started.' },
  }),
  Icon: spec({ type: 'Icon', props: { name: 'check', size: 24 } }),

  // Navigation
  Breadcrumb: spec({
    type: 'Breadcrumb',
    props: { items: [{ label: 'Shop', href: '#' }, { label: 'Footwear' }] },
  }),
  Steps: spec({
    type: 'Steps',
    props: { steps: [{ label: 'Cart' }, { label: 'Details' }, { label: 'Payment' }], current: 1 },
  }),
  Tabs: spec({
    type: 'Tabs',
    props: {
      tabs: [
        { id: 'overview', label: 'Overview', content: 'Overview content.' },
        { id: 'activity', label: 'Activity', content: 'Activity content.' },
      ],
    },
  }),
  Accordion: spec({
    type: 'Accordion',
    props: {
      type: 'single',
      items: [
        { id: 'what', title: 'What is Lighter?', content: 'Design-in-code prototyping.' },
        { id: 'how', title: 'How does it work?', content: 'Ingest, author, review, hand off.' },
      ],
    },
  }),
  // Layout + media (#166 catalog exposure)
  Box: spec({ type: 'Box', props: { padding: '6' }, children: [text('Inset by a spacing token.')] }),
  AspectRatio: spec({
    type: 'AspectRatio',
    props: { ratio: 16 / 9 },
    children: [
      {
        type: 'Image',
        props: {
          src: 'https://placehold.co/640x360/e2e8f0/475569?text=16%3A9',
          alt: 'Placeholder in a 16:9 frame',
        },
      },
    ],
  }),
  Image: spec({
    type: 'Image',
    props: {
      src: 'https://placehold.co/320x200/e2e8f0/475569?text=Image',
      alt: 'A placeholder image',
      rounded: true,
    },
  }),

  // Forms
  Field: spec({
    type: 'Field',
    props: { label: 'Email', required: true, help: 'We only use this for order updates.' },
    children: [{ type: 'Input', props: { type: 'email', placeholder: 'you@example.com' } }],
  }),
  Input: spec({ type: 'Input', props: { placeholder: 'Street address' } }),
  Textarea: spec({ type: 'Textarea', props: { placeholder: 'Delivery notes', rows: 3 } }),
  Select: spec({
    type: 'Select',
    props: {
      value: 'standard',
      options: [
        { label: 'Standard — 3-5 days', value: 'standard' },
        { label: 'Express — next day', value: 'express' },
      ],
    },
  }),
  Checkbox: spec({ type: 'Checkbox', props: { label: 'Billing address is the same', checked: true } }),
  Radio: spec({ type: 'Radio', props: { label: 'Card', name: 'payment', checked: true } }),
  Switch: spec({ type: 'Switch', props: { label: 'Save these details', checked: true } }),
};
