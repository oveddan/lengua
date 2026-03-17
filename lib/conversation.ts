export interface ConversationExchange {
  input: string;
  response_main: string;
}

export function buildConversationContext(exchanges: ConversationExchange[]): string {
  return exchanges
    .map(ex => `You: ${ex.input}\nAssistant: ${ex.response_main}`)
    .join('\n\n');
}
