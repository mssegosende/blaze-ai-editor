/**
 * Scores a saved comparison without calling any model: how often each model's
 * runs agree with each other, and which facts each reply kept.
 *
 * Usage: pnpm score-models <results.json>
 */
import { readFileSync } from 'node:fs'
import { computeDiff } from '../src/lib/diff.ts'

interface SavedRecord {
  model: string
  round: number
  case: string
  step: 'first' | 'refine'
  ok: boolean
  rewrite?: string
}

/** The claims in each paragraph that a rewrite should keep. */
const FACTS: Record<string, Record<string, RegExp>> = {
  'why-now-shorter': {
    'most of the day': /(most|much) of (their|its|the|each) day/i,
    'repeated questions': /same questions|repeat|repetitive/i,
    'harder tickets': /harder tickets|complex tickets/i,
    'end of the day': /end of the day|late in the day/i,
    'customers wait': /customers[^.]*wait|wait[^.]*customers/i,
  },
  'metrics-measurable': {
    'it is working': /know it's working/i,
    'about tickets': /ticket/i,
    'about speed': /time|sooner|faster|within|hours/i,
  },
  'markdown-formal': {
    'bold term': /\*\*median first response\*\*/,
    '9 hours': /9 hours/,
    'as of today': /today|currently/i,
    'report link': /\[Q3 support report\]\(https:\/\/example\.com\/reports\/q3\)/,
    'too slow': /too slow|slower than/i,
    'team agrees': /team|teammates/i,
  },
}

function factsKept(caseName: string, rewrite: string): string[] {
  return Object.entries(FACTS[caseName] ?? {})
    .filter(([, pattern]) => pattern.test(rewrite))
    .map(([fact]) => fact)
}

function percent(part: number, whole: number): string {
  return `${Math.round((part / whole) * 100)}%`
}

const path = process.argv[2]
if (!path) throw new Error('Usage: pnpm score-models <results.json>')

const { models, cases, records } = JSON.parse(readFileSync(path, 'utf8')) as {
  models: string[]
  cases: { name: string; passage: string }[]
  records: SavedRecord[]
}

/** Scored with the app's real diff, so these are the changes a user would see. */
function diffOf(run: SavedRecord) {
  const passage = cases.find((testCase) => testCase.name === run.case)?.passage ?? ''
  return computeDiff(passage, run.rewrite ?? '')
}

for (const model of models) {
  const ok = records.filter((record) => record.model === model && record.ok)
  const groups = Map.groupBy(ok, (record) => `${record.case} / ${record.step}`)

  const blocks = ok.filter((run) => diffOf(run).mode === 'block').length
  let matchingChangePairs = 0
  let matchingFactPairs = 0
  let identicalTextPairs = 0
  let pairs = 0
  let factsTotal = 0
  let factsFound = 0
  const lines: string[] = []

  for (const [group, runs] of groups) {
    const caseName = runs[0]?.case ?? ''
    const kept = runs.map((run) => factsKept(caseName, run.rewrite ?? ''))
    for (const facts of kept) {
      factsFound += facts.length
      factsTotal += Object.keys(FACTS[caseName] ?? {}).length
    }
    for (let a = 0; a < runs.length; a += 1) {
      for (let b = a + 1; b < runs.length; b += 1) {
        pairs += 1
        const [runA, runB] = [runs[a], runs[b]]
        if (runA && runB && diffOf(runA).changeCount === diffOf(runB).changeCount) {
          matchingChangePairs += 1
        }
        if (kept[a]?.join() === kept[b]?.join()) matchingFactPairs += 1
        if (runs[a]?.rewrite === runs[b]?.rewrite) identicalTextPairs += 1
      }
    }
    const missing = kept.map((facts) =>
      Object.keys(FACTS[caseName] ?? {}).filter((fact) => !facts.includes(fact)),
    )
    lines.push(
      `  ${group}: changes [${runs.map((run) => diffOf(run).changeCount).join(', ')}]` +
        ` | percent changed [${runs.map((run) => Math.round(diffOf(run).changedRatio * 100)).join(', ')}]` +
        ` | missing ${JSON.stringify(missing)}`,
    )
  }

  console.log(`\n${model}`)
  console.log(`  same number of changes: ${matchingChangePairs}/${pairs} pairs (${percent(matchingChangePairs, pairs)})`)
  console.log(`  same facts kept:        ${matchingFactPairs}/${pairs} pairs (${percent(matchingFactPairs, pairs)})`)
  console.log(`  identical text:         ${identicalTextPairs}/${pairs} pairs (${percent(identicalTextPairs, pairs)})`)
  console.log(`  facts kept overall:     ${factsFound}/${factsTotal} (${percent(factsFound, factsTotal)})`)
  console.log(`  shown as a block:       ${blocks}/${ok.length}`)
  console.log(lines.join('\n'))
}
