/**
 * Runs the app's real prompt and model call against candidate models, on the
 * same paragraphs, and writes the results to a JSON file.
 *
 * Usage: pnpm compare-models <output.json>
 */
import { writeFileSync } from 'node:fs'
import { diffWordsWithSpace } from 'diff'
import { callModel } from '../server/openRouter.ts'
import type { SuggestRequest } from '../shared/contract.ts'

const MODELS = ['anthropic/claude-haiku-5.5', 'openai/gpt-6-luna', 'anthropic/claude-sonnet-5.5']
const ROUNDS = 3
const SPEND_LIMIT_USD = 0.5

interface Case {
  name: string
  passage: string
  instruction: string
  heading: string
}

const CASES: Case[] = [
  {
    name: 'why-now-shorter',
    heading: 'Why now',
    instruction: 'Make it shorter.',
    passage:
      "Right now the support team basically spends most of their day answering the same questions over and over again, which means that a lot of the time they don't actually get to the harder tickets until the end of the day and some customers end up waiting way longer than they should.",
  },
  {
    name: 'metrics-measurable',
    heading: 'Success metrics',
    instruction: 'Make it measurable.',
    passage: "We'll know it's working when tickets get answered faster.",
  },
  {
    name: 'markdown-formal',
    heading: 'Baseline',
    instruction: 'Make it more formal.',
    passage:
      "Our **median first response** is 9 hours today, according to the [Q3 support report](https://example.com/reports/q3). We kinda think that's too slow and honestly most folks on the team would agree with that.",
  },
]

const REFINE_INSTRUCTION = 'Make it warmer.'

const apiKey = process.env.OPENROUTER_API_KEY ?? ''
const outputPath = process.argv[2]

if (!outputPath) throw new Error('Usage: pnpm compare-models <output.json>')
if (apiKey === '') {
  console.error('OPENROUTER_API_KEY is not set. Nothing was called.')
  process.exit(1)
}

/** Keeps the key out of anything printed or saved, whatever the source. */
function redact(text: string): string {
  return text.split(apiKey).join('[redacted]')
}

function measureChanges(original: string, rewrite: string) {
  const countChars = (text: string) => text.replace(/\s/g, '').length
  let changes = 0
  let changedChars = 0
  let inChange = false
  for (const part of diffWordsWithSpace(original, rewrite)) {
    if (part.added || part.removed) {
      changedChars += countChars(part.value)
      if (!inChange) changes += 1
      inChange = true
    } else if (part.value.trim() !== '') {
      inChange = false
    }
  }
  const total = countChars(original) + countChars(rewrite)
  return { changes, percentChanged: total === 0 ? 0 : Math.round((changedChars / total) * 100) }
}

function checkOutput(passage: string, rewrite: string, rationale: string) {
  const digits = (text: string): string[] => text.replace(/\[[^\]]*\]/g, '').match(/\d+/g) ?? []
  const urls = (text: string): string[] => text.match(/\]\([^)]*\)/g) ?? []
  const bold = (text: string): string[] => text.match(/\*\*[^*]+\*\*/g) ?? []
  return {
    inventedNumbers: digits(rewrite).filter((n) => !digits(passage).includes(n)),
    lostNumbers: digits(passage).filter((n) => !digits(rewrite).includes(n)),
    urlsKept: urls(passage).every((url) => rewrite.includes(url)),
    boldKept: bold(passage).length === 0 || bold(rewrite).length >= bold(passage).length,
    placeholders: rewrite.match(/\[[^\]]+\](?!\()/g) ?? [],
    rationaleWords: rationale.trim().split(/\s+/).length,
  }
}

interface RunRecord {
  model: string
  round: number
  case: string
  step: 'first' | 'refine'
  ok: boolean
  latencyMs: number
  costUsd: number | null
  promptTokens: number | null
  completionTokens: number | null
  reasoningTokens: number | null
  error?: string
  rewrite?: string
  rationale?: string
  changes?: number
  percentChanged?: number
  checks?: ReturnType<typeof checkOutput>
}

const records: RunRecord[] = []
let spentUsd = 0
let stoppedForBudget = false

async function run(
  model: string,
  round: number,
  testCase: Case,
  step: RunRecord['step'],
  request: SuggestRequest,
): Promise<string | null> {
  const started = performance.now()
  const result = await callModel(request, { apiKey, model })
  const latencyMs = Math.round(performance.now() - started)
  const base = { model, round, case: testCase.name, step, latencyMs }

  if (!result.ok) {
    records.push({
      ...base,
      ok: false,
      error: redact(`${result.code}: ${result.detail}`),
      costUsd: null,
      promptTokens: null,
      completionTokens: null,
      reasoningTokens: null,
    })
    console.log(`${model} r${round} ${testCase.name} ${step}: FAILED ${redact(result.detail)}`)
    return null
  }

  const { rewrite, rationale } = result.suggestion
  spentUsd += result.usage.costUsd ?? 0
  records.push({
    ...base,
    ok: true,
    ...result.usage,
    rewrite: redact(rewrite),
    rationale: redact(rationale),
    ...measureChanges(testCase.passage, rewrite),
    checks: checkOutput(testCase.passage, rewrite, rationale),
  })
  console.log(`${model} r${round} ${testCase.name} ${step}: ${latencyMs}ms`)
  return rewrite
}

async function runModel(model: string) {
  for (let round = 1; round <= ROUNDS; round += 1) {
    for (const testCase of CASES) {
      if (spentUsd >= SPEND_LIMIT_USD) {
        stoppedForBudget = true
        return
      }
      const context = { heading: testCase.heading, before: null, after: null }
      const first = await run(model, round, testCase, 'first', {
        selection: testCase.passage,
        target: 'selection',
        instruction: testCase.instruction,
        currentSuggestion: null,
        context,
      })
      if (first === null) continue
      await run(model, round, testCase, 'refine', {
        selection: testCase.passage,
        target: 'selection',
        instruction: REFINE_INSTRUCTION,
        currentSuggestion: first,
        context,
      })
    }
  }
}

await Promise.all(MODELS.map(runModel))

writeFileSync(
  outputPath,
  JSON.stringify({ models: MODELS, rounds: ROUNDS, cases: CASES, spentUsd, stoppedForBudget, records }, null, 2) + '\n',
)
console.log(`Done. ${records.length} calls, $${spentUsd.toFixed(4)} spent. Stopped for budget: ${stoppedForBudget}`)
