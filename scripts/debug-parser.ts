import { generateObject } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import { ActionsSchema } from '../packages/narrator/src/llm/schemas.ts';
import { PARSER_SYSTEM } from '../packages/narrator/src/llm/prompts.ts';

const ollama = createOllama({ baseURL: 'http://localhost:11434/api' });
const model = ollama('llama3:latest');

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

console.log(`\n=== Input: ${JSON.stringify(input)} ===\n`);

try {
  const result = await generateObject({
    model,
    schema: ActionsSchema,
    system: PARSER_SYSTEM,
    prompt: userPrompt,
  });
  console.log('SUCCESS:', JSON.stringify(result.object, null, 2));
} catch (err) {
  console.log('ERROR name:', (err as Error).name);
  console.log('ERROR message:', (err as Error).message);
  const e = err as any;
  for (const k of ['cause','responseBody','statusCode','url','data','text']) {
    if (e[k] !== undefined) {
      const v = typeof e[k] === 'string' ? e[k] : JSON.stringify(e[k], null, 2);
      console.log(`ERROR.${k}:`, v);
    }
  }
}
