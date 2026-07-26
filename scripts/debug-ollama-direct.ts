import { z } from 'zod';
import { ActionsSchema } from '../packages/narrator/src/llm/schemas.ts';
import { PARSER_SYSTEM } from '../packages/narrator/src/llm/prompts.ts';

// Convert Zod schema to JSON-schema the same way the AI SDK does.
const jsonSchema = z.toJSONSchema(ActionsSchema);

const perception = {
  room: {
    id: 1, name: 'Aide quarters',
    description: 'A narrow cabin.',
    exits: [{ dir: 'out', destinationId: 2, destinationName: 'corridor' }],
    visibleEntities: [
      { id: 10, name: 'credentials badge', aliases: ['badge'], portable: true },
      { id: 11, name: 'datapad', aliases: [], portable: true },
    ],
    lit: true,
  },
  inventory: [],
};

const input = process.argv[2] ?? 'leave the cabin';
const userPrompt = `Player input: ${JSON.stringify(input)}\n\nPerception:\n${JSON.stringify(perception, null, 2)}`;

const body = {
  model: 'llama3:latest',
  messages: [
    { role: 'system', content: PARSER_SYSTEM },
    { role: 'user', content: userPrompt },
  ],
  stream: false,
  format: jsonSchema,
};

console.log('=== JSON Schema being sent ===');
console.log(JSON.stringify(jsonSchema, null, 2).slice(0, 4000));
console.log('\n=== Calling Ollama /api/chat directly ===');

const res = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
console.log('HTTP status:', res.status, res.statusText);
const text = await res.text();
console.log('Response body:');
console.log(text.slice(0, 4000));
