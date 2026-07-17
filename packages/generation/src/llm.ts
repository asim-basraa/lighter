/**
 * The LLM boundary. Everything that generates a spec depends only on this interface, so generation
 * logic (prompt building, parse, catalog-validate, retry) is testable with an injected fake and
 * never makes a paid API call in tests. `AnthropicLlmClient` is the single production implementation.
 */
export interface LlmClient {
  /** Complete a single turn: a system prompt + a user message → the assistant's text. */
  complete(system: string, user: string): Promise<string>;
}
