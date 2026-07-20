import { z } from 'zod';
import { catalogComponent, type CatalogComponent } from '../util/catalog.js';
import { PageShell, Container, Stack, Grid, Divider, Box, AspectRatio } from '../components/layout.js';
import { Heading, Text, Link } from '../components/typography.js';
import { Button } from '../components/button.js';
import { Card, Badge, Avatar, Progress, Stat, EmptyState } from '../components/data-display.js';
import { Alert, Callout } from '../components/feedback.js';
import { Breadcrumb, Steps, Tabs, Accordion } from '../components/navigation.js';
import { DescriptionList, Timeline } from '../components/table.js';
import { Icon, type IconName } from '../components/icon.js';
import {
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  Switch,
  Field,
} from '../components/form.js';

/**
 * The json-render catalog: the subset of the design system that is meaningful in an AI-authored,
 * prop-driven spec. Each entry is the single source of truth — the Zod `props` power json-render's
 * catalog AND (converted to JSON Schema at build) the `dist/catalog.json` that Lighter ingests and
 * constrains generation to. The full React library is larger; not everything belongs in a spec.
 */
/**
 * The design system's full spacing scale. The catalog previously exposed a hand-picked subset, which
 * meant a spec could not express spacings the components themselves support — an arbitrary ceiling
 * that showed up as "the editor is limited" (#166).
 */
const SPACE_SCALE = z.enum(['0', '1', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24']);

/** Map the catalog's short flex words onto CSS values (`start` -> `flex-start`). */
function flexValue(value?: string): string | undefined {
  if (!value) return undefined;
  if (value === 'start' || value === 'end') return `flex-${value}`;
  return value;
}

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
      gap: SPACE_SCALE.optional(),
      align: z.enum(['start', 'center', 'end', 'stretch', 'baseline']).optional(),
      justify: z
        .enum(['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly'])
        .optional(),
      wrap: z.boolean().optional(),
    }),
    render: ({ props, children }) => (
      <Stack
        direction={props.direction}
        gap={props.gap}
        align={flexValue(props.align)}
        justify={flexValue(props.justify)}
        wrap={props.wrap}
      >
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
      gap: SPACE_SCALE.optional(),
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
    description:
      'A clickable action button in one of six variants and three sizes. `loading` and `disabled` render the states a real button has.',
    props: z.object({
      label: z.string(),
      variant: z
        .enum(['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'])
        .optional(),
      size: z.enum(['sm', 'md', 'lg']).optional(),
      loading: z.boolean().optional(),
      disabled: z.boolean().optional(),
      block: z.boolean().optional(),
    }),
    render: ({ props }) => (
      <Button
        variant={props.variant}
        size={props.size}
        loading={props.loading}
        disabled={props.disabled}
        block={props.block}
      >
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
  catalogComponent({
    name: 'Box',
    slots: ['default'],
    description:
      'A plain container with optional padding from the spacing scale. Use to inset a group of components.',
    props: z.object({ padding: SPACE_SCALE.optional() }),
    render: ({ props, children }) => <Box padding={props.padding}>{children}</Box>,
  }),
  catalogComponent({
    name: 'AspectRatio',
    slots: ['default'],
    description:
      'Holds its children at a fixed width-to-height ratio. Wrap an Image to stop layout shifting as it loads.',
    props: z.object({ ratio: z.number().positive().optional() }),
    render: ({ props, children }) => <AspectRatio ratio={props.ratio}>{children}</AspectRatio>,
  }),
  catalogComponent({
    name: 'Image',
    slots: [],
    description:
      'An image by URL. `alt` describes it for screen readers — leave it empty only when the image is decorative.',
    props: z.object({
      src: z.string(),
      alt: z.string(),
      fit: z.enum(['cover', 'contain', 'fill', 'none', 'scale-down']).optional(),
      rounded: z.boolean().optional(),
    }),
    render: ({ props }) => (
      <img
        src={props.src}
        alt={props.alt}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: props.fit ?? 'cover',
          borderRadius: props.rounded ? 'var(--radius-md)' : undefined,
        }}
      />
    ),
  }),
  catalogComponent({
    name: 'Field',
    slots: ['default'],
    description:
      'Labels a form control and shows help or error text beneath it. Put exactly one input component in its children.',
    props: z.object({
      label: z.string().optional(),
      required: z.boolean().optional(),
      help: z.string().optional(),
      error: z.string().optional(),
    }),
    render: ({ props, children }) => (
      <Field label={props.label} required={props.required} help={props.help} error={props.error}>
        {children}
      </Field>
    ),
  }),
  catalogComponent({
    name: 'Input',
    slots: [],
    description:
      'A single-line text input. Wrap it in a Field to give it a label. Set `invalid` to show the error state.',
    props: z.object({
      type: z.enum(['text', 'email', 'password', 'number', 'tel', 'url', 'search']).optional(),
      placeholder: z.string().optional(),
      value: z.string().optional(),
      size: z.enum(['sm', 'md', 'lg']).optional(),
      invalid: z.boolean().optional(),
      disabled: z.boolean().optional(),
      required: z.boolean().optional(),
    }),
    // `defaultValue`, not `value`: a spec has no event handlers (actions are #155), and a controlled
    // input without onChange is both a React warning and un-typeable for anyone clicking through.
    render: ({ props }) => (
      <Input
        type={props.type}
        placeholder={props.placeholder}
        defaultValue={props.value}
        size={props.size}
        invalid={props.invalid}
        disabled={props.disabled}
        required={props.required}
      />
    ),
  }),
  catalogComponent({
    name: 'Textarea',
    slots: [],
    description: 'A multi-line text input. Wrap it in a Field to give it a label.',
    props: z.object({
      placeholder: z.string().optional(),
      value: z.string().optional(),
      rows: z.number().int().min(1).max(20).optional(),
      invalid: z.boolean().optional(),
      disabled: z.boolean().optional(),
    }),
    render: ({ props }) => (
      <Textarea
        placeholder={props.placeholder}
        defaultValue={props.value}
        rows={props.rows}
        invalid={props.invalid}
        disabled={props.disabled}
      />
    ),
  }),
  catalogComponent({
    name: 'Select',
    slots: [],
    description:
      'A dropdown of options. Wrap it in a Field to give it a label. Options are declared as label/value pairs.',
    props: z.object({
      options: z.array(z.object({ label: z.string(), value: z.string() })),
      value: z.string().optional(),
      size: z.enum(['sm', 'md', 'lg']).optional(),
      invalid: z.boolean().optional(),
      disabled: z.boolean().optional(),
    }),
    render: ({ props }) => (
      <Select
        defaultValue={props.value}
        size={props.size}
        invalid={props.invalid}
        disabled={props.disabled}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    ),
  }),
  catalogComponent({
    name: 'Checkbox',
    slots: [],
    description: 'A checkbox with an inline label.',
    props: z.object({
      label: z.string().optional(),
      checked: z.boolean().optional(),
      disabled: z.boolean().optional(),
    }),
    render: ({ props }) => (
      <Checkbox label={props.label} defaultChecked={props.checked} disabled={props.disabled} />
    ),
  }),
  catalogComponent({
    name: 'Radio',
    slots: [],
    description:
      'A radio button with an inline label. Give every radio in one choice the same `name`.',
    props: z.object({
      label: z.string().optional(),
      name: z.string().optional(),
      checked: z.boolean().optional(),
      disabled: z.boolean().optional(),
    }),
    render: ({ props }) => (
      <Radio
        label={props.label}
        name={props.name}
        defaultChecked={props.checked}
        disabled={props.disabled}
      />
    ),
  }),
  catalogComponent({
    name: 'Switch',
    slots: [],
    description: 'An on/off toggle with an inline label.',
    props: z.object({
      label: z.string().optional(),
      checked: z.boolean().optional(),
      disabled: z.boolean().optional(),
    }),
    render: ({ props }) => (
      <Switch label={props.label} defaultChecked={props.checked} disabled={props.disabled} />
    ),
  }),
];
