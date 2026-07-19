import { defineRegistry } from '@json-render/react';
import { catalog } from './catalog.js';
import { Button, Card, PageShell, Stack, Text } from './components.js';

/**
 * Binds catalog component names to their React implementations. `Renderer` uses this to turn a
 * json-render spec into rendered UI. The catalog declares no actions, so the `actions` map is omitted.
 */
export const { registry } = defineRegistry(catalog, {
  components: {
    PageShell: ({ props, children }) => <PageShell title={props.title}>{children}</PageShell>,
    Stack: ({ props, children }) => (
      <Stack direction={props.direction} gap={props.gap}>
        {children}
      </Stack>
    ),
    Card: ({ props, children }) => <Card title={props.title}>{children}</Card>,
    Text: ({ props }) => <Text content={props.content} size={props.size} />,
    Button: ({ props }) => <Button label={props.label} variant={props.variant} />,
  },
});
