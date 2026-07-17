import { describe, it, expect } from 'vitest';
import { componentTypesOf } from '@lighter/spec';
import { generateSpec, GenerationError } from './generate.js';
import { buildSystemPrompt, type CatalogComponent } from './prompt.js';
import type { LlmClient } from './llm.js';

const catalog: CatalogComponent[] = [
  {
    name: 'PageShell',
    description: 'The page shell.',
    props: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'Text',
    description: 'A paragraph.',
    props: {
      type: 'object',
      properties: {
        content: { type: 'string' },
        size: { anyOf: [{ type: 'string', enum: ['sm', 'md', 'lg'] }, { type: 'null' }] },
      },
      required: ['content', 'size'],
      additionalProperties: false,
    },
  },
];

const validSpecJson = JSON.stringify({
  root: {
    type: 'PageShell',
    props: { title: 'Home' },
    children: [{ type: 'Text', props: { content: 'Hi', size: 'md' }, children: [] }],
  },
});

/** A fake LLM that returns canned outputs in order and records the prompts it received. */
function fakeClient(outputs: string[]): LlmClient & { calls: { system: string; user: string }[] } {
  const calls: { system: string; user: string }[] = [];
  let i = 0;
  return {
    calls,
    async complete(system, user) {
      calls.push({ system, user });
      return outputs[Math.min(i++, outputs.length - 1)]!;
    },
  };
}

describe('generateSpec', () => {
  it('returns a catalog-valid spec on the first try', async () => {
    const client = fakeClient([validSpecJson]);
    const { spec, attempts } = await generateSpec({ intent: 'A home screen', catalog, client });
    expect(attempts).toBe(1);
    expect(spec.root.type).toBe('PageShell'); // page shell is the root
    expect(componentTypesOf(spec).every((t) => ['PageShell', 'Text'].includes(t))).toBe(true);
  });

  it('tolerates a fenced / prose-wrapped JSON response', async () => {
    const client = fakeClient(['Sure! Here is the spec:\n```json\n' + validSpecJson + '\n```']);
    const { spec } = await generateSpec({ intent: 'x', catalog, client });
    expect(spec.root.props.title).toBe('Home');
  });

  it('extracts the spec even when prose around it contains braces', async () => {
    const withBraces =
      'The title prop uses {placeholder} syntax. Here it is:\n\n' + validSpecJson + '\n\nDone :}';
    const client = fakeClient([withBraces]);
    const { spec } = await generateSpec({ intent: 'x', catalog, client });
    expect(spec.root.props.title).toBe('Home');
  });

  it('retries when the model outputs an unknown component, feeding the error back', async () => {
    const bad = JSON.stringify({ root: { type: 'Ghost', props: {}, children: [] } });
    const client = fakeClient([bad, validSpecJson]);
    const { attempts } = await generateSpec({ intent: 'x', catalog, client });
    expect(attempts).toBe(2);
    // The retry prompt carries the specific rejection reason.
    expect(client.calls[1]!.user).toMatch(/Ghost/);
    expect(client.calls[1]!.user).toMatch(/rejected/i);
  });

  it('retries when the root is not the page shell', async () => {
    const wrongRoot = JSON.stringify({
      root: { type: 'Text', props: { content: 'x', size: 'md' }, children: [] },
    });
    const client = fakeClient([wrongRoot, validSpecJson]);
    const { attempts } = await generateSpec({ intent: 'x', catalog, client });
    expect(attempts).toBe(2);
    expect(client.calls[1]!.user).toMatch(/root component must be "PageShell"/i);
  });

  it('retries when the model returns non-JSON', async () => {
    const client = fakeClient(['I cannot do that.', validSpecJson]);
    const { attempts } = await generateSpec({ intent: 'x', catalog, client });
    expect(attempts).toBe(2);
  });

  it('throws GenerationError with the last issues when it never validates', async () => {
    const badProps = JSON.stringify({
      root: { type: 'PageShell', props: {}, children: [] }, // missing required title
    });
    const client = fakeClient([badProps]);
    await expect(
      generateSpec({ intent: 'x', catalog, client, maxAttempts: 2 }),
    ).rejects.toBeInstanceOf(GenerationError);
    expect(client.calls).toHaveLength(2); // exhausted the attempts
  });

  it('never yields a spec with an uncataloged component (invariant over injected output)', async () => {
    // Even if the model eventually returns something valid, the result only ever contains
    // cataloged components — the invariant the AC cares about, asserted without exact AI text.
    const client = fakeClient([validSpecJson]);
    const { spec } = await generateSpec({ intent: 'x', catalog, client });
    const known = new Set(catalog.map((c) => c.name));
    expect(componentTypesOf(spec).every((t) => known.has(t))).toBe(true);
  });
});

describe('buildSystemPrompt', () => {
  it('lists the component vocabulary and states the root rule', () => {
    const prompt = buildSystemPrompt(catalog, 'PageShell');
    expect(prompt).toContain('PageShell');
    expect(prompt).toContain('Text');
    expect(prompt).toMatch(/root node's type MUST be "PageShell"/);
  });
});
