import checksMd from '../ruleset/fa/checks.md?raw'
import tier1ExamplesMd from '../ruleset/fa/examples/tier1-examples.md?raw'
import tier2ExamplesMd from '../ruleset/fa/examples/tier2-examples.md?raw'
import modesMd from '../ruleset/fa/modes.md?raw'
import outputSchemaMd from '../ruleset/fa/output-schema.md?raw'
import readmeMd from '../ruleset/fa/README.md?raw'
import rulesMd from '../ruleset/fa/RULES.md?raw'

// The Farsi style guide (ruleset/fa/), bundled at build time like the
// English one. checks.md speaks to two audiences: its client:start …
// client:end blocks are patterns and tests for the code, stripped before
// the model sees it (as the guide itself specifies).

const OPEN = '<!-- client:' + 'start -->'
const CLOSE = '<!-- client:' + 'end -->'
export const forModel = (md: string) =>
  md
    .split(OPEN)
    .map((part, i) => (i ? part.slice(part.indexOf(CLOSE) + CLOSE.length) : part))
    .join('')

export const rulesetFa = {
  readme: readmeMd,
  rules: rulesMd,
  checks: forModel(checksMd),
  modes: modesMd,
  outputSchema: outputSchemaMd,
  tier1Examples: tier1ExamplesMd,
  tier2Examples: tier2ExamplesMd,
} as const

export const RULESET_VERSION_FA = `fa rev ${Math.max(...[...readmeMd.matchAll(/^Rev (\d+):/gm)].map((m) => Number(m[1])), 0)}`
