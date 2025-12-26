// Test JSON parsing logic for Claude responses

function extractJson(text: string): string {
  let jsonStr = text.trim();

  // Try to extract from code blocks
  if (jsonStr.startsWith('```')) {
    // Remove opening ``` and optional language tag
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '');
    // Remove closing ```
    jsonStr = jsonStr.replace(/\n?```$/, '');
  }

  // Find the JSON object boundaries
  const firstBrace = jsonStr.indexOf('{');
  const lastBrace = jsonStr.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
  }

  return jsonStr.trim();
}

// Test cases
const testCases: { name: string; input: string; shouldParse: boolean }[] = [
  {
    name: 'Exact error case - starts with backticks',
    input: '```json\n{\n  "original_sentence": "test",\n  "translation": "test",\n  "phrases": [],\n  "words": []\n}\n```',
    shouldParse: true,
  },
  {
    name: 'Plain JSON',
    input: `{"original_sentence": "hola", "translation": "hello", "phrases": [], "words": []}`,
    shouldParse: true,
  },
  {
    name: 'JSON with code block',
    input: `\`\`\`json
{"original_sentence": "hola", "translation": "hello", "phrases": [], "words": []}
\`\`\``,
    shouldParse: true,
  },
  {
    name: 'JSON with code block no language',
    input: `\`\`\`
{"original_sentence": "hola", "translation": "hello", "phrases": [], "words": []}
\`\`\``,
    shouldParse: true,
  },
  {
    name: 'JSON with text before code block',
    input: `Here is the analysis:
\`\`\`json
{"original_sentence": "hola", "translation": "hello", "phrases": [], "words": []}
\`\`\``,
    shouldParse: true,
  },
  {
    name: 'Complex JSON with arrays',
    input: `\`\`\`json
{
  "original_sentence": "El conductor fue asesinado",
  "translation": "The driver was murdered",
  "phrases": [
    { "spanish": "fue asesinado", "english": "was murdered", "base_form": "ser asesinado" }
  ],
  "words": [
    { "spanish": "conductor", "english": "driver", "base_form": "conductor" }
  ]
}
\`\`\``,
    shouldParse: true,
  },
  {
    name: 'JSON with newlines inside code block',
    input: `\`\`\`json
{
  "original_sentence": "test",
  "translation": "test",
  "phrases": [],
  "words": []
}
\`\`\``,
    shouldParse: true,
  },
];

console.log('=== JSON Parsing Tests ===\n');

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  try {
    const extracted = extractJson(tc.input);
    const parsed = JSON.parse(extracted);

    if (tc.shouldParse) {
      console.log(`✓ ${tc.name}`);
      passed++;
    } else {
      console.log(`✗ ${tc.name} - should have failed but parsed successfully`);
      failed++;
    }
  } catch (e) {
    if (!tc.shouldParse) {
      console.log(`✓ ${tc.name} - correctly failed`);
      passed++;
    } else {
      console.log(`✗ ${tc.name} - failed to parse`);
      console.log(`  Input: ${tc.input.slice(0, 50)}...`);
      console.log(`  Error: ${e}`);
      failed++;
    }
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
