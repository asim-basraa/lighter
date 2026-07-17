import Anthropic from '@anthropic-ai/sdk';
import type { LlmClient } from './llm.js';

/**
 * The production `LlmClient`, backed by the Anthropic API. This is the ONLY module that calls the
 * model, so a paid request happens only when this is wired in (never in tests, which inject a fake).
 * Uses the latest Opus with adaptive thinking; the spec format is enforced by generation's validate-
 * or-retry loop, not by a response schema (the internal spec is recursive, which structured outputs
 * can't constrain).
 */
export class AnthropicLlmClient implements LlmClient {
  private readonly client: Anthropic;

  /* c8 ignore start -- thin SDK wrapper; behavior is exercised via injected fakes in generate.test */
  constructor(
    private readonly model = 'claude-opus-4-8',
    client?: Anthropic,
  ) {
    // A no-arg `Anthropic()` resolves ANTHROPIC_API_KEY from the environment.
    this.client = client ?? new Anthropic();
  }

  async complete(system: string, user: string): Promise<string> {
    // No `thinking` param: this SDK version predates adaptive-thinking types, and the task is a
    // constrained JSON emission (the system prompt enforces JSON-only), not deep reasoning. Bump the
    // SDK and add `thinking: { type: 'adaptive' }` if generation quality needs it.
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8000,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');
  }
  /* c8 ignore stop */
}
