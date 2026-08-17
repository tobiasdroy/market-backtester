import type { CashFlowRule, GlidePathRule, StrategyRule } from '@/engine/types'

interface RuleTimelineProps {
  rules: StrategyRule[]
  durationMonths: number
  onSelectRule: (id: string) => void
  /** When set, the year ruler shows age (currentAge + year) instead of
   * "yr N". */
  currentAge?: number | null
}

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 150
const MARGIN_X = 24
const TRACK_WIDTH = VIEW_WIDTH - MARGIN_X * 2
const CONTRIBUTION_Y = 40
const GLIDE_PATH_Y = 58
const BASELINE_Y = 75
const WITHDRAWAL_Y = 110

const COLOR = {
  contribution: 'var(--series-stocks)',
  withdrawal: 'var(--series-cash)',
  rebalance: 'var(--series-bonds)',
  glidePath: 'var(--series-4)',
}

function niceTickStep(durationYears: number): number {
  const target = durationYears / 8
  const steps = [1, 2, 5, 10, 20, 25, 50]
  return steps.find((s) => s >= target) ?? 50
}

/** A single-track visual timeline of a strategy's rules across its
 * duration: contribution/withdrawal rules as ranged bars above/below a
 * baseline, rebalance rules as dots on it. Purely illustrative (not a
 * data chart), so it skips axes/gridline ticks beyond a light year ruler. */
export function RuleTimeline({
  rules,
  durationMonths,
  onSelectRule,
  currentAge,
}: RuleTimelineProps) {
  const durationYears = durationMonths / 12
  const yearToX = (year: number) => MARGIN_X + (year / durationYears) * TRACK_WIDTH

  const tickStep = niceTickStep(durationYears)
  const ticks: number[] = []
  for (let y = 0; y <= durationYears; y += tickStep) ticks.push(y)

  const cashFlowRules = rules.filter(
    (r): r is CashFlowRule => r.type === 'contribution' || r.type === 'withdrawal',
  )
  const rebalanceRules = rules.filter((r) => r.type === 'rebalance')
  const glidePathRules = rules.filter((r): r is GlidePathRule => r.type === 'glidePath')

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="w-full" role="img" aria-label="Strategy timeline">
        {/* Year ruler */}
        <line
          x1={MARGIN_X}
          x2={VIEW_WIDTH - MARGIN_X}
          y1={BASELINE_Y}
          y2={BASELINE_Y}
          stroke="var(--gridline)"
          strokeWidth={1}
        />
        {ticks.map((year) => (
          <g key={year}>
            <line
              x1={yearToX(year)}
              x2={yearToX(year)}
              y1={BASELINE_Y - 4}
              y2={BASELINE_Y + 4}
              stroke="var(--baseline)"
              strokeWidth={1}
            />
            <text
              x={yearToX(year)}
              y={VIEW_HEIGHT - 6}
              textAnchor="middle"
              fontSize={11}
              fill="var(--text-muted)"
            >
              {currentAge != null ? `age ${currentAge + year}` : `yr ${year}`}
            </text>
          </g>
        ))}

        {/* Contribution / withdrawal ranges */}
        {cashFlowRules.map((rule) => {
          const startYear = rule.startOffset.months / 12
          const endYear = rule.endOffset ? rule.endOffset.months / 12 : durationYears
          const y = rule.type === 'contribution' ? CONTRIBUTION_Y : WITHDRAWAL_Y
          const x1 = yearToX(startYear)
          const x2 = Math.max(x1 + 4, yearToX(endYear))
          return (
            <g
              key={rule.id}
              onClick={() => onSelectRule(rule.id)}
              className="cursor-pointer"
            >
              <line
                x1={x1}
                x2={x2}
                y1={y}
                y2={y}
                stroke={COLOR[rule.type]}
                strokeWidth={4}
                strokeLinecap="round"
              />
              <circle cx={x1} cy={y} r={4} fill="var(--surface-1)" stroke={COLOR[rule.type]} strokeWidth={2} />
            </g>
          )
        })}

        {/* Glide-path ranges */}
        {glidePathRules.map((rule) => {
          const x1 = yearToX(rule.startOffset.months / 12)
          const x2 = Math.max(x1 + 4, yearToX(rule.endOffset.months / 12))
          return (
            <g key={rule.id} onClick={() => onSelectRule(rule.id)} className="cursor-pointer">
              <line
                x1={x1}
                x2={x2}
                y1={GLIDE_PATH_Y}
                y2={GLIDE_PATH_Y}
                stroke={COLOR.glidePath}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray="2 3"
              />
              <circle cx={x1} cy={GLIDE_PATH_Y} r={4} fill="var(--surface-1)" stroke={COLOR.glidePath} strokeWidth={2} />
            </g>
          )
        })}

        {/* Rebalance events */}
        {rebalanceRules.map((rule) => {
          const x = yearToX(rule.startOffset.months / 12)
          return (
            <g key={rule.id} onClick={() => onSelectRule(rule.id)} className="cursor-pointer">
              <circle cx={x} cy={BASELINE_Y} r={7} fill={COLOR.rebalance} stroke="var(--surface-1)" strokeWidth={2} />
            </g>
          )
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        <LegendItem color={COLOR.contribution} label="Contribution" />
        <LegendItem color={COLOR.withdrawal} label="Withdrawal" />
        <LegendItem color={COLOR.rebalance} label="Rebalance" />
        <LegendItem color={COLOR.glidePath} label="Glide path" />
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}
