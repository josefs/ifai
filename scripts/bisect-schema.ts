import { z } from 'zod';
import { ActionsSchema } from '../packages/narrator/src/llm/schemas.ts';

const schema = z.toJSONSchema(ActionsSchema);

async function tryIt(label: string, format: any) {
  const body = {
    model: 'llama3:latest',
    messages: [{ role: 'user', content: 'Return {"actions":[{"kind":"look"}]}' }],
    stream: false,
    format,
  };
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`[${label}] HTTP ${res.status}: ${text.slice(0, 200)}`);
}

await tryIt('full schema', schema);

// Strip the giant integer maximum
const stripped = JSON.parse(JSON.stringify(schema), (k, v) => {
  if (k === 'maximum' && v > 1e6) return undefined;
  return v;
});
await tryIt('without large maximum', stripped);

// Now drop all converse_* variants too
const noConverse = JSON.parse(JSON.stringify(stripped));
const inner = noConverse.properties.actions.items;
inner.anyOf = (inner.anyOf ?? inner.oneOf).filter((s: any) => !s.properties?.kind?.const?.startsWith?.('converse'));
await tryIt('no converse + no max', noConverse);

// Just look/inventory/wait
const tiny = {
  type: 'object',
  properties: {
    actions: { type: 'array', items: { type: 'object', properties: { kind: { type: 'string', enum: ['look','inventory','wait'] } }, required: ['kind'] } },
  },
  required: ['actions'],
};
await tryIt('tiny 3-action schema', tiny);
