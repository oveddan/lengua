import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import {
  createChatSession,
  createChatExchange,
  getChatExchangesBySession,
  getChatSession,
} from '@/lib/db';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  const { input, sessionId } = await request.json();

  if (!input || typeof input !== 'string') {
    return NextResponse.json({ error: 'input is required' }, { status: 400 });
  }

  // Get or create session
  let currentSessionId = sessionId;
  if (!currentSessionId) {
    const newSession = await createChatSession();
    currentSessionId = newSession.id;
  } else {
    // Verify session exists
    const session = await getChatSession(currentSessionId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
  }

  // Get conversation context
  const previousExchanges = await getChatExchangesBySession(currentSessionId);
  const conversationContext = previousExchanges
    .map(ex => `You: ${ex.input}\nAssistant: ${ex.response_main}`)
    .join('\n\n');

  const prompt = `You are a Spanish language assistant for a learner living in Mexico. They use WhatsApp daily and need help with real conversations.

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

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = message.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    return NextResponse.json({ error: 'No response from Claude' }, { status: 500 });
  }

  // Extract JSON from response
  let jsonStr = textContent.text.trim();

  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '');
    jsonStr = jsonStr.replace(/\n?```$/, '');
  }

  // Find JSON boundaries
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  const parsed = JSON.parse(jsonStr.trim());

  // Save exchange to database
  const exchange = await createChatExchange({
    session_id: currentSessionId,
    input: input.trim(),
    intent: parsed.intent,
    response_main: parsed.response.main,
    response_json: JSON.stringify(parsed.response),
  });

  return NextResponse.json({
    sessionId: currentSessionId,
    exchangeId: exchange.id,
    intent: parsed.intent,
    response: parsed.response,
  });
}
