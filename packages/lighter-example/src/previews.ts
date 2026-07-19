/**
 * A preview spec per component: a minimal json-render spec (flat `root` + `elements` format) that
 * renders the component in isolation. Lighter's inventory gallery renders these for a live preview,
 * and they double as fixtures for the render tests. Each preview is rooted at its own component.
 */
export interface PreviewSpec {
  root: string;
  elements: Record<string, { type: string; props: Record<string, unknown>; children?: string[] }>;
}

export const previews: Record<string, PreviewSpec> = {
  PageShell: {
    root: 'shell',
    elements: {
      shell: { type: 'PageShell', props: { title: 'Dashboard' }, children: ['intro'] },
      intro: {
        type: 'Text',
        props: { content: 'Welcome to the shell.', size: 'md' },
        children: [],
      },
    },
  },
  Stack: {
    root: 'stack',
    elements: {
      stack: {
        type: 'Stack',
        props: { direction: 'vertical', gap: '4' },
        children: ['one', 'two'],
      },
      one: { type: 'Text', props: { content: 'One', size: 'md' }, children: [] },
      two: { type: 'Text', props: { content: 'Two', size: 'md' }, children: [] },
    },
  },
  Card: {
    root: 'card',
    elements: {
      card: { type: 'Card', props: { title: 'Card title' }, children: ['body'] },
      body: { type: 'Text', props: { content: 'Card body copy.', size: 'md' }, children: [] },
    },
  },
  Text: {
    root: 'text',
    elements: {
      text: { type: 'Text', props: { content: 'The quick brown fox.', size: 'lg' }, children: [] },
    },
  },
  Button: {
    root: 'button',
    elements: {
      button: { type: 'Button', props: { label: 'Click me', variant: 'primary' }, children: [] },
    },
  },
};
