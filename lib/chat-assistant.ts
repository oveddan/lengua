import { anthropic, extractJsonFromResponse, getTextFromResponse } from './claude-helpers';
import {
  createChatSession,
  createChatExchange,
  getChatExchangesBySession,
  getChatSession,
} from './db';

export interface ChatResponse {
  intent: string;
  response: {
    main: string;
    alternatives?: string[];
    explanation?: string;
    corrections?: string[];
    words?: Array<{ spanish: string; english: string; notes?: string }>;
  };
}

export interface ChatResult {
  sessionId: string;
  exchangeId: string;
  intent: string;
  response: ChatResponse['response'];
}

function buildChatPrompt(input: string, conversationContext: string): string {
  return `You are a Spanish language assistant for a learner living in Mexico. They use WhatsApp daily and need help with real conversations.

**Context:** Mexican Spanish, informal tú-form by default, WhatsApp-appropriate phrasing.

**User input:** "${input}"

${conversationContext ? `**Recent conversation:**\n${conversationContext}\n\n` : ''}Detect the user's intent and respond accordingly:

1. **"How do you say..." / "Say in Spanish:" / "Translate:" / English text needing translation** → English to Spanish
   - Return natural Mexican Spanish
   - Include 1-2 alternatives if phrasing varies
   - Consider the conversation context for better translations

2. **"What does X mean?" / "What's X?"** → Lookup/Explanation
   - Give the meaning
   - Note if it's a verb (include tense, reflexive, etc.)
   - Add usage notes or common phrases

3. **"Is this correct:" / validation request** → Check their Spanish
   - Point out errors gently
   - Suggest more natural phrasing
   - Explain why (briefly)

4. **Plain Spanish text** → Translate to English
   - Translate naturally
   - Note any idioms or tricky phrases
   - Use conversation context to inform translation

5. **Plain English text** (no "How do you say" prefix) → Translate to Spanish
   - Give Mexican Spanish translation
   - Include alternatives

Return JSON only (no markdown):
{
  "intent": "english_to_spanish" | "spanish_to_english" | "lookup" | "validation",
  "response": {
    "main": "primary response text",
    "alternatives": ["alt 1", "alt 2"],
    "explanation": "grammar/usage notes (for lookups or when helpful)",
    "corrections": ["correction 1"],
    "words": [{"spanish": "word", "english": "meaning", "notes": "optional context"}]
  }
}`;
}

export async function chatAssist(input: string, sessionId?: string): Promise<ChatResult> {
  // Get or create session
  let currentSessionId = sessionId;
  if (!currentSessionId) {
    const newSession = await createChatSession();
    currentSessionId = newSession.id;
  } else {
    const session = await getChatSession(currentSessionId);
    if (!session) {
      throw new Error('Session not found');
    }
  }

  // Get conversation context
  const previousExchanges = await getChatExchangesBySession(currentSessionId);
  const conversationContext = previousExchanges
    .map(ex => `You: ${ex.input}\nAssistant: ${ex.response_main}`)
    .join('\n\n');

  const prompt = buildChatPrompt(input, conversationContext);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = getTextFromResponse(message);
  const parsed = JSON.parse(extractJsonFromResponse(text));

  // Save exchange to database
  const exchange = await createChatExchange({
    session_id: currentSessionId,
    input: input.trim(),
    intent: parsed.intent,
    response_main: parsed.response.main,
    response_json: JSON.stringify(parsed.response),
  });

  return {
    sessionId: currentSessionId,
    exchangeId: exchange.id,
    intent: parsed.intent,
    response: parsed.response,
  };
}
