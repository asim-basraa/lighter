import { z } from 'zod';
import { catalogComponent, type CatalogComponent } from '../util/catalog.js';
import { PageShell, Container, Stack, Grid, Divider } from '../components/layout.js';
import { Heading, Text, Link } from '../components/typography.js';
import { Button } from '../components/button.js';
import { Card, Badge, Avatar, Progress, Stat, EmptyState } from '../components/data-display.js';
import { Alert, Callout } from '../components/feedback.js';
import { Breadcrumb, Steps, Tabs, Accordion } from '../components/navigation.js';
import { DescriptionList, Timeline } from '../components/table.js';
import { Icon, type IconName } from '../components/icon.js';

/**
 * The json-render catalog: the subset of the design system that is meaningful in an AI-authored,
 * prop-driven spec. Each entry is the single source of truth — the Zod `props` power json-render's
 * catalog AND (converted to JSON Schema at build) the `dist/catalog.json` that Lighter ingests and
 * constrains generation to. The full React library is larger; not everything belongs in a spec.
 */
export const catalogDefs: CatalogComponent[] = [
  catalogComponent({
    name: 'PageShell',
    slots: ['default'],
    description:
      'The layout-owning page shell. Every screen starts here; renders a titled header above a main content region. Put page content in its children.',
    props: z.object({ title: z.string() }),
    render: ({ props, children }) => <PageShell title={props.title}>{children}</PageShell>,
  }),
  catalogComponent({
    name: 'Container',
    slots: ['default'],
    description: 'A max-width, horizontally-centered content column. Wrap page sections in it.',
    props: z.object({ size: z.enum(['sm', 'md', 'lg', 'xl', 'full']).optional() }),
    render: ({ props, children }) => <Container size={props.size}>{children}</Container>,
  }),
  catalogComponent({
    name: 'Stack',
    slots: ['default'],
    description:
      'A flex layout that stacks children vertically (default) or horizontally with a spacing-token gap. The primary way to arrange components.',
    props: z.object({
      direction: z.enum(['vertical', 'horizontal']).optional(),
      gap: z.enum(['1', '2', '3', '4', '6', '8']).optional(),
    }),
    render: ({ props, children }) => (
      <Stack direction={props.direction} gap={props.gap}>
        {children}
      </Stack>
    ),
  }),
  catalogComponent({
    name: 'Grid',
    slots: ['default'],
    description:
      'A CSS grid with a fixed column count and a spacing-token gap. Use for card grids.',
    props: z.object({
      columns: z.number().int().min(1).max(6).optional(),
      gap: z.enum(['2', '3', '4', '6', '8']).optional(),
    }),
    render: ({ props, children }) => (
      <Grid columns={props.columns ?? 2} gap={props.gap}>
        {children}
      </Grid>
    ),
  }),
  catalogComponent({
    name: 'Divider',
    description: 'A hairline rule separating content.',
    props: z.object({ orientation: z.enum(['horizontal', 'vertical']).optional() }),
    render: ({ props }) => <Divider orientation={props.orientation} />,
  }),
  catalogComponent({
    name: 'Heading',
    description: 'A section heading at a level 1–6 (level sets the type scale and tag).',
    props: z.object({ content: z.string(), level: z.number().int().min(1).max(6).optional() }),
    render: ({ props }) => (
      <Heading level={(props.level as 1 | 2 | 3 | 4 | 5 | 6) ?? 2}>{props.content}</Heading>
    ),
  }),
  catalogComponent({
    name: 'Text',
    description: 'A run of text at a type-scale style, with an optional tone. Use for body copy.',
    props: z.object({
      content: z.string(),
      variant: z.enum(['body', 'small', 'title', 'code']).optional(),
      tone: z.enum(['default', 'muted', 'subtle', 'primary', 'destructive']).optional(),
    }),
    render: ({ props }) => (
      <Text as="p" variant={props.variant} tone={props.tone}>
        {props.content}
      </Text>
    ),
  }),
  catalogComponent({
    name: 'Link',
    description: 'A hyperlink to another screen or URL.',
    props: z.object({ label: z.string(), href: z.string(), external: z.boolean().optional() }),
    render: ({ props }) => (
      <Link href={props.href} external={props.external}>
        {props.label}
      </Link>
    ),
  }),
  catalogComponent({
    name: 'Card',
    slots: ['default'],
    description: 'A surface container with an optional title. Group related content in it.',
    props: z.object({ title: z.string().optional() }),
    render: ({ props, children }) => <Card title={props.title}>{children}</Card>,
  }),
  catalogComponent({
    name: 'Button',
    description: 'A clickable action button in one of six variants and three sizes.',
    props: z.object({
      label: z.string(),
      variant: z
        .enum(['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'])
        .optional(),
      size: z.enum(['sm', 'md', 'lg']).optional(),
    }),
    render: ({ props }) => (
      <Button variant={props.variant} size={props.size}>
        {props.label}
      </Button>
    ),
  }),
  catalogComponent({
    name: 'Badge',
    description: 'A small status label with a tone and fill style.',
    props: z.object({
      label: z.string(),
      tone: z
        .enum(['neutral', 'primary', 'accent', 'success', 'warning', 'destructive', 'info'])
        .optional(),
      variant: z.enum(['soft', 'solid', 'outline']).optional(),
    }),
    render: ({ props }) => (
      <Badge tone={props.tone} variant={props.variant}>
        {props.label}
      </Badge>
    ),
  }),
  catalogComponent({
    name: 'Avatar',
    description: 'A user avatar — an image, or initials from a name.',
    props: z.object({
      name: z.string().optional(),
      src: z.string().optional(),
      size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
    }),
    render: ({ props }) => <Avatar name={props.name} src={props.src} size={props.size} />,
  }),
  catalogComponent({
    name: 'Progress',
    description: 'A progress bar (0–100). Omit the value for an indeterminate bar.',
    props: z.object({
      value: z.number().min(0).max(100).optional(),
      tone: z.enum(['primary', 'success', 'warning', 'destructive', 'accent', 'info']).optional(),
    }),
    render: ({ props }) => <Progress value={props.value} tone={props.tone} />,
  }),
  catalogComponent({
    name: 'Stat',
    description: 'A single headline statistic — a label, a value, and an optional hint.',
    props: z.object({ label: z.string(), value: z.string(), hint: z.string().optional() }),
    render: ({ props }) => <Stat label={props.label} value={props.value} hint={props.hint} />,
  }),
  catalogComponent({
    name: 'Alert',
    description: 'An inline message box for contextual feedback (info/success/warning/error).',
    props: z.object({
      status: z.enum(['info', 'success', 'warning', 'destructive', 'neutral']).optional(),
      title: z.string().optional(),
      message: z.string(),
    }),
    render: ({ props }) => (
      <Alert status={props.status} title={props.title}>
        {props.message}
      </Alert>
    ),
  }),
  catalogComponent({
    name: 'Callout',
    slots: ['default'],
    description: 'A softer, left-accented note for tips or asides.',
    props: z.object({
      status: z.enum(['info', 'success', 'warning', 'destructive', 'neutral']).optional(),
      title: z.string().optional(),
    }),
    render: ({ props, children }) => (
      <Callout status={props.status} title={props.title}>
        {children}
      </Callout>
    ),
  }),
  catalogComponent({
    name: 'EmptyState',
    description: 'A placeholder for an empty region — a title and optional description.',
    props: z.object({ title: z.string(), description: z.string().optional() }),
    render: ({ props }) => <EmptyState title={props.title} description={props.description} />,
  }),
  catalogComponent({
    name: 'Icon',
    description:
      'An inline icon by name (e.g. check, search, user, settings, bell, star, home, mail, calendar).',
    props: z.object({ name: z.string(), size: z.number().int().min(12).max(48).optional() }),
    render: ({ props }) => <Icon name={props.name as IconName} size={props.size} />,
  }),
  catalogComponent({
    name: 'Breadcrumb',
    description: 'A breadcrumb trail of links showing the path to the current page.',
    props: z.object({
      items: z.array(z.object({ label: z.string(), href: z.string().optional() })),
    }),
    render: ({ props }) => <Breadcrumb items={props.items} />,
  }),
  catalogComponent({
    name: 'Steps',
    description: 'A stepper showing progress through an ordered sequence of steps.',
    props: z.object({
      steps: z.array(z.object({ label: z.string(), description: z.string().optional() })),
      current: z.number().int().min(0),
      orientation: z.enum(['horizontal', 'vertical']).optional(),
    }),
    render: ({ props }) => (
      <Steps steps={props.steps} current={props.current} orientation={props.orientation} />
    ),
  }),
  catalogComponent({
    name: 'DescriptionList',
    description: 'A list of term / description pairs (key–value metadata).',
    props: z.object({
      items: z.array(z.object({ term: z.string(), description: z.string() })),
      orientation: z.enum(['horizontal', 'vertical']).optional(),
    }),
    render: ({ props }) => <DescriptionList items={props.items} orientation={props.orientation} />,
  }),
  catalogComponent({
    name: 'Timeline',
    description: 'A vertical timeline of events, each with a title and optional description.',
    props: z.object({
      items: z.array(
        z.object({
          title: z.string(),
          description: z.string().optional(),
          tone: z.enum(['default', 'primary', 'success', 'warning', 'destructive']).optional(),
        }),
      ),
    }),
    render: ({ props }) => <Timeline items={props.items} />,
  }),
  catalogComponent({
    name: 'Tabs',
    description: 'A tabbed interface; each tab has a label and text content.',
    props: z.object({
      tabs: z.array(z.object({ id: z.string(), label: z.string(), content: z.string() })),
    }),
    render: ({ props }) => <Tabs tabs={props.tabs} />,
  }),
  catalogComponent({
    name: 'Accordion',
    description: 'A vertical set of collapsible sections, each with a title and text content.',
    props: z.object({
      items: z.array(z.object({ id: z.string(), title: z.string(), content: z.string() })),
      type: z.enum(['single', 'multiple']).optional(),
    }),
    render: ({ props }) => <Accordion items={props.items} type={props.type} />,
  }),
];
