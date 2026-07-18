'use client';

import {
  Heading,
  Text,
  Stack,
  HStack,
  Grid,
  Card,
  Stat,
  Badge,
  Button,
  Progress,
  Avatar,
  Divider,
} from '@lighter/design-system';

const ROWS = [
  { name: 'Acme Corp', plan: 'Team', usage: 82, status: 'Active' as const },
  { name: 'Globex', plan: 'Pro', usage: 47, status: 'Active' as const },
  { name: 'Initech', plan: 'Free', usage: 12, status: 'Trial' as const },
  { name: 'Umbrella', plan: 'Team', usage: 95, status: 'Past due' as const },
];

const statusTone = (s: string) =>
  s === 'Active' ? 'success' : s === 'Trial' ? 'info' : 'destructive';

export default function DashboardPage() {
  return (
    <Stack direction="vertical" gap="6">
      <HStack justify="space-between">
        <Stack direction="vertical" gap="1">
          <Heading level={1}>Dashboard</Heading>
          <Text tone="muted">A sample application page assembled from the design system.</Text>
        </Stack>
        <Button variant="primary">New account</Button>
      </HStack>

      <Grid columns={4} gap="4" className="starter-grid">
        <Card>
          <Stat label="MRR" value="$48,210" hint="+12% MoM" />
        </Card>
        <Card>
          <Stat label="Accounts" value="1,204" hint="+38 this week" />
        </Card>
        <Card>
          <Stat label="Seats used" value="8,410" hint="72% of plan" />
        </Card>
        <Card>
          <Stat label="Churn" value="1.2%" hint="−0.3%" />
        </Card>
      </Grid>

      <Card title="Accounts">
        <Stack direction="vertical" gap="0">
          {ROWS.map((r, i) => (
            <div key={r.name}>
              {i > 0 && <Divider />}
              <HStack justify="space-between" gap="4" style={{ padding: 'var(--spacing-3) 0' }}>
                <HStack gap="3">
                  <Avatar name={r.name} size="sm" />
                  <Stack direction="vertical" gap="0">
                    <Text weight="semibold">{r.name}</Text>
                    <Text as="span" variant="small" tone="muted">
                      {r.plan}
                    </Text>
                  </Stack>
                </HStack>
                <HStack gap="4">
                  <div style={{ width: 120 }}>
                    <Progress value={r.usage} />
                  </div>
                  <Badge tone={statusTone(r.status)} variant="soft">
                    {r.status}
                  </Badge>
                </HStack>
              </HStack>
            </div>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
