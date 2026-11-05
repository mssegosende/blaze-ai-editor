/**
 * Does sending the section as read-only context measurably help? Runs the chosen
 * model on the same passages with and without it.
 *
 * Decision rule, fixed before the first run: keep the context only if it improves
 * at least one check below and never repeats context text in a rewrite.
 *
 * Usage: pnpm compare-context <output.json>
 */
import { writeFileSync } from 'node:fs'
import { callModel } from '../server/openRouter.ts'
import type { SuggestContext } from '../shared/contract.ts'

const MODEL = 'anthropic/claude-sonnet-5.5'
const RUNS = 3

interface Case {
  name: string
  question: string
  passage: string
  instruction: string
  context: SuggestContext
  /** A rewrite passes when this matches. */
  pass: RegExp
  /** Context text that must not appear in the rewrite. */
  repeated: RegExp
}

const CASES: Case[] = [
  {
    name: 'baseline-in-context',
    question: 'Does it use the real baseline instead of a placeholder?',
    passage: "We'll know it's working when tickets get answered faster.",
    instruction: 'Make it measurable.',
    context: {
      heading: 'Success metrics',
      before: 'Our median first response is 9 hours today.',
      after: null,
    },
    pass: /9 hours/,
    repeated: /Our median first response is 9 hours today/,
  },
  {
    name: 'pronoun-in-context',
    question: 'Does "it" stay correct, as "it" or as the knowledge base?',
    passage: "Honestly it's kinda out of date and people don't really trust it.",
    instruction: 'Rewrite this so it stands on its own as a formal sentence.',
    context: {
      heading: 'Shared knowledge',
      before: 'The team keeps its answers in a shared knowledge base.',
      after: null,
    },
    pass: /knowledge base/i,
    repeated: /keeps its answers in a shared knowledge base/i,
  },
  {
    name: 'neighbour-not-repeated',
    question: 'Does it avoid restating the neighbouring sentence?',
    passage:
      'We are going to log every suggestion and whether it was accepted, so we can audit it later if we need to, and nothing is sent automatically, ever.',
    instruction: 'Make it more formal.',
    context: {
      heading: "How we'll keep it safe",
      before: 'Every answer the assistant writes is reviewed by a person before it goes out.',
      after: null,
    },
    pass: /log|record/i,
    repeated: /reviewed by a person|reviewed by a human/i,
  },
]

const apiKey = process.env.OPENROUTER_API_KEY ?? ''
const outputPath = process.argv[2]

if (!outputPath) throw new Error('Usage: pnpm compare-context <output.json>')
if (apiKey === '') {
  console.error('OPENROUTER_API_KEY is not set. Nothing was called.')
  process.exit(1)
}

const redact = (text: string) => text.split(apiKey).join('[redacted]')
const records: Record<string, unknown>[] = []
let spentUsd = 0

for (const testCase of CASES) {
  for (const withContext of [true, false]) {
    for (let run = 1; run <= RUNS; run += 1) {
      const started = performance.now()
      const result = await callModel(
        {
          selection: testCase.passage,
          target: 'selection',
          instruction: testCase.instruction,
          currentSuggestion: null,
          context: withContext ? testCase.context : null,
        },
        { apiKey, model: MODEL },
      )
      const latencyMs = Math.round(performance.now() - started)
      const base = { case: testCase.name, withContext, run, latencyMs }

      if (!result.ok) {
        records.push({ ...base, ok: false, error: redact(result.detail) })
        console.log(`${testCase.name} context=${withContext} run ${run}: FAILED`)
        continue
      }

      const { rewrite, rationale } = result.suggestion
      spentUsd += result.usage.costUsd ?? 0
      const passed = testCase.pass.test(rewrite)
      const repeated = testCase.repeated.test(rewrite)
      records.push({
        ...base,
        ok: true,
        passed,
        repeated,
        promptTokens: result.usage.promptTokens,
        costUsd: result.usage.costUsd,
        rewrite: redact(rewrite),
        rationale: redact(rationale),
      })
      console.log(
        `${testCase.name} | context=${withContext} | run ${run} | pass=${passed} repeated=${repeated} | ${latencyMs}ms | $${result.usage.costUsd}\n    ${redact(rewrite)}`,
      )
    }
  }
}

writeFileSync(
  outputPath,
  JSON.stringify({ model: MODEL, runs: RUNS, spentUsd, cases: CASES.map(({ name, question, passage, instruction, context }) => ({ name, question, passage, instruction, context })), records }, null, 2) + '\n',
)
console.log(`Done. ${records.length} calls, $${spentUsd.toFixed(4)} spent.`)
