'use client';

import { useMemo, useState } from 'react';
import { Heading, Text, Stack, Grid, Card, Textarea, Alert } from '@lighter/design-system';
import { SpecView, type PreviewSpec } from '@lighter/design-system/registry';
import { toJsonRender } from '@lighter/spec/render';
import { SpecSchema } from '@lighter/spec';
import { sampleSpecJson } from '../../lib/sampleSpec.js';

/**
 * The json-render wrapper: author a Lighter internal spec (left), convert it to json-render, and
 * render it through the design system (right). This is exactly how a Lighter-generated spec would
 * render in a consumer app — paste a spec from `GET /share/:token` or `POST /generate` and see it live.
 */
export default function RenderPage() {
  const [text, setText] = useState(sampleSpecJson);

  const result = useMemo<{ spec: PreviewSpec } | { error: string }>(() => {
    try {
      const parsed = SpecSchema.parse(JSON.parse(text));
      return { spec: toJsonRender(parsed) as unknown as PreviewSpec };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Invalid spec' };
    }
  }, [text]);

  return (
    <Stack direction="vertical" gap="6">
      <Stack direction="vertical" gap="2">
        <Heading level={1}>Render a spec</Heading>
        <Text tone="muted">
          Edit the Lighter internal spec on the left; it’s converted to json-render and rendered by
          the design system on the right.
        </Text>
      </Stack>

      <Grid columns={2} gap="4" className="starter-grid">
        <Stack direction="vertical" gap="2">
          <Text as="span" variant="small" tone="muted">
            Spec (JSON)
          </Text>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={22}
            style={{ fontFamily: 'var(--font-family-mono)', fontSize: 13 }}
            spellCheck={false}
          />
        </Stack>

        <Stack direction="vertical" gap="2">
          <Text as="span" variant="small" tone="muted">
            Rendered
          </Text>
          {'error' in result ? (
            <Alert status="destructive" title="Could not render">
              {result.error}
            </Alert>
          ) : (
            <Card padded={false}>
              <SpecView spec={result.spec} />
            </Card>
          )}
        </Stack>
      </Grid>
    </Stack>
  );
}
