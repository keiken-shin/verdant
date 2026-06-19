import type { LLMProvider } from '@/types';
import { OllamaProvider } from './ollama';

class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  getAll(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  getDefault(): LLMProvider | undefined {
    return this.providers.values().next().value;
  }

  createOllama(id: string, endpoint: string): OllamaProvider {
    const provider = new OllamaProvider(id, endpoint);
    this.register(provider);
    return provider;
  }

  remove(id: string): void {
    this.providers.delete(id);
  }
}

// Global singleton registry
export const providerRegistry = new ProviderRegistry();

// Initialize default Ollama provider
providerRegistry.createOllama(
  'provider-ollama-default',
  'http://127.0.0.1:11434'
);
