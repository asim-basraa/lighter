'use client';

import Link from 'next/link';
import { Heading, Text, Card, Button, Badge, Stack, Grid, Callout } from '@lighter/design-system';

const FEATURES = [
  {
    title: 'DTCG-token design system',
    body: 'Swap the DTCG tokens and the whole app re-themes. Light/dark built in.',
    href: '/components',
    cta: 'Browse components',
  },
  {
    title: 'json-render, wired',
    body: 'Render Lighter-generated (or hand-authored) specs through the design system.',
    href: '/render',
    cta: 'Render a spec',
  },
  {
    title: 'Page architecture ready',
    body: 'Shell, nav, theme and routing are set up — just add pages under app/.',
    href: '/dashboard',
    cta: 'See a sample page',
  },
];

export default function HomePage() {
  return (
    <Stack direction="vertical" gap="8">
      <Stack direction="vertical" gap="3">
        <Badge tone="primary" variant="soft">
          Lighter Starter
        </Badge>
        <Heading level={1}>Start here.</Heading>
        <Text tone="muted" style={{ maxWidth: 640 }}>
          A Next.js app wired to the Lighter design system and json-render. Fork it, point your DTCG
          tokens at your brand, and you have your product’s foundation — with an
          AI-to-review-to-handoff pipeline (Lighter) ready to plug in.
        </Text>
        <Stack direction="horizontal" gap="2">
          <Link href="/components">
            <Button variant="primary">Explore components</Button>
          </Link>
          <Link href="/render">
            <Button variant="outline">Render a spec</Button>
          </Link>
        </Stack>
      </Stack>

      <Grid columns={3} gap="4" className="starter-grid">
        {FEATURES.map((f) => (
          <Card key={f.title} title={f.title}>
            <Stack direction="vertical" gap="4">
              <Text tone="muted">{f.body}</Text>
              <Link href={f.href}>
                <Button variant="secondary" size="sm">
                  {f.cta}
                </Button>
              </Link>
            </Stack>
          </Card>
        ))}
      </Grid>

      <Callout status="info" title="Make it yours">
        <Text as="span">
          Edit <code>packages/design-system/tokens/*.tokens.json</code> to re-theme, add pages under{' '}
          <code>app/</code>, and register new components in the design system’s json-render catalog.
        </Text>
      </Callout>
    </Stack>
  );
}
