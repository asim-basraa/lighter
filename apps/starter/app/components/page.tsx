'use client';

import {
  Heading,
  Text,
  Stack,
  HStack,
  Grid,
  Divider,
  Card,
  Button,
  IconButton,
  ButtonGroup,
  Badge,
  Tag,
  Avatar,
  AvatarGroup,
  Progress,
  Spinner,
  Skeleton,
  Stat,
  EmptyState,
  Alert,
  Callout,
  Banner,
  Input,
  Textarea,
  Select,
  Checkbox,
  Radio,
  RadioGroup,
  Switch,
  Slider,
  Field,
  Link as DSLink,
  Code,
  Kbd,
  type Tone,
} from '@lighter/design-system';
import type { ReactNode } from 'react';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack direction="vertical" gap="4">
      <Heading level={2}>{title}</Heading>
      <Card>
        <Stack direction="vertical" gap="4">
          {children}
        </Stack>
      </Card>
    </Stack>
  );
}

const TONES: Tone[] = ['neutral', 'primary', 'accent', 'success', 'warning', 'destructive', 'info'];

export default function ComponentsPage() {
  return (
    <Stack direction="vertical" gap="8">
      <Stack direction="vertical" gap="2">
        <Heading level={1}>Components</Heading>
        <Text tone="muted">
          Every component is styled entirely from design-system tokens — toggle the theme (top
          right) to watch them re-skin. Same components, different DTCG tokens.
        </Text>
      </Stack>

      <Section title="Buttons">
        <HStack gap="2" wrap>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </HStack>
        <HStack gap="2" wrap>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button loading>Loading</Button>
          <IconButton aria-label="Add" variant="outline">
            +
          </IconButton>
          <ButtonGroup>
            <Button variant="outline">Left</Button>
            <Button variant="outline">Mid</Button>
            <Button variant="outline">Right</Button>
          </ButtonGroup>
        </HStack>
      </Section>

      <Section title="Badges, tags & avatars">
        <HStack gap="2" wrap>
          {TONES.map((t) => (
            <Badge key={t} tone={t} variant="soft">
              {t}
            </Badge>
          ))}
        </HStack>
        <HStack gap="2" wrap>
          {TONES.map((t) => (
            <Badge key={t} tone={t} variant="solid">
              {t}
            </Badge>
          ))}
        </HStack>
        <HStack gap="2">
          <Tag onRemove={() => {}}>Removable</Tag>
          <Tag tone="primary">Design</Tag>
          <AvatarGroup>
            <Avatar name="Dana Ray" />
            <Avatar name="Ravi Kohli" />
            <Avatar name="Mia Lu" />
          </AvatarGroup>
        </HStack>
      </Section>

      <Section title="Forms">
        <Grid columns={2} gap="4" className="starter-grid">
          <Field label="Email" htmlFor="email" help="We’ll never share it.">
            <Input id="email" type="email" placeholder="you@example.com" />
          </Field>
          <Field label="Plan" htmlFor="plan">
            <Select id="plan" defaultValue="pro">
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="team">Team</option>
            </Select>
          </Field>
          <Field label="Bio" htmlFor="bio">
            <Textarea id="bio" placeholder="A few words…" />
          </Field>
          <Stack direction="vertical" gap="3">
            <Checkbox label="Email me updates" defaultChecked />
            <Switch label="Dark data" />
            <RadioGroup name="tier">
              <Radio name="tier" label="Monthly" defaultChecked />
              <Radio name="tier" label="Annual" />
            </RadioGroup>
            <Slider defaultValue={60} />
          </Stack>
        </Grid>
      </Section>

      <Section title="Feedback">
        <Alert status="info" title="Heads up">
          This is an informational alert.
        </Alert>
        <Alert status="success" title="Saved">
          Your changes were saved.
        </Alert>
        <Alert status="warning" title="Careful">
          This action can’t be undone.
        </Alert>
        <Alert status="destructive" title="Something went wrong">
          Please try again.
        </Alert>
        <Callout status="info" title="Tip">
          Callouts are great for docs-style asides.
        </Callout>
        <Banner status="info">A full-width announcement banner.</Banner>
      </Section>

      <Section title="Data display">
        <Grid columns={3} gap="4" className="starter-grid">
          <Stat label="Revenue" value="$48.2k" hint="+12% MoM" />
          <Stat label="Active users" value="8,410" hint="+310 today" />
          <Stat label="Churn" value="1.2%" hint="−0.3%" />
        </Grid>
        <Stack direction="vertical" gap="2">
          <Progress value={72} />
          <Progress value={40} tone="success" />
          <Progress tone="accent" />
        </Stack>
        <HStack gap="4">
          <Spinner />
          <Skeleton width={200} height={16} />
          <Skeleton width={120} height={16} />
        </HStack>
        <Divider />
        <EmptyState
          icon="🗂️"
          title="No projects yet"
          description="Create your first project to get started."
          action={<Button size="sm">New project</Button>}
        />
      </Section>

      <Section title="Typography">
        <Heading level={1}>Display heading</Heading>
        <Heading level={2}>Section heading</Heading>
        <Heading level={3}>Title heading</Heading>
        <Text>
          Body text with a <DSLink href="#">link</DSLink>, some <Code>inline code</Code>, and a{' '}
          <Kbd>⌘K</Kbd> shortcut.
        </Text>
        <Text tone="muted">Muted secondary text.</Text>
      </Section>
    </Stack>
  );
}
