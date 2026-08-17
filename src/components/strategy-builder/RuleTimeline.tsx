import type { AllocationTarget, CashFlowRule, GlidePathRule, RebalanceRule, StrategyRule } from '@/engine/types'

interface RuleTimelineProps {
  rules: StrategyRule[]
  durationMonths: number
  onSelectRule: (id: string) => void
  /** Stock allocation at year 0, so the allocation line has a starting
   * point even before any rebalance/glide path rule fires. */
  initialAllocation: AllocationTarget
  /** When set, the year ruler shows age (currentAge + year) instead of
   * "yr N". */
  currentAge?: number | null
}

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 180
const MARGIN_X = 24
const TRACK_WIDTH = VIEW_WIDTH - MARGIN_X * 2

// Each rule type gets its own vertical band; within a band, height
// encodes relative magnitude (contribution/withdrawal: that rule's own
// amount range; allocation: stock % from 0-100) rather than every bar
// sitting at one fixed height regardless of value.
const CONTRIBUTION_BAND = { center: 28, half: 12 }
const ALLOCATION_BAND = { center: 72, half: 16 }
const WITHDRAWAL_BAND = { center: 145, half: 12 }
const YEAR_RULER_Y = 108
const LABEL_Y = VIEW_HEIGHT - 6

const COLOR = {
  contribution: 'var(--series-stocks)',
  withdrawal: 'var(--series-cash)',
  allocation: 'var(--series-4)',
}

function niceTickStep(durationYears: number): number {
  const target = durationYears / 8
  const steps = [1, 2, 5, 10, 20, 25, 50]
  return steps.find((s) => s >= target) ?? 50
}

/** Maps a 0-1 fraction to a y coordinate within a band - 1 is the top of
 * the band (smaller y), 0 is the bottom, so "more" always reads as
 * "higher" within that band regardless of where the band itself sits. */
function bandY(band: { center: number; half: number }, fraction: number): number {
  return band.center + band.half - fraction * 2 * band.half
}

interface CashFlowPoint {
  year: number
  amount: number
}

/** The rule's amount over its active [startOffset, endOffset] range: flat
 * at `amount` unless it ramps toward `endAmount` by `rampEndOffset`, in
 * which case it rises/falls linearly there and then holds. */
function cashFlowPoints(rule: CashFlowRule, durationYears: number): CashFlowPoint[] {
  const startYear = rule.startOffset.months / 12
  const endYear = rule.endOffset ? rule.endOffset.months / 12 : durationYears
  if (rule.endAmount === undefined || !rule.rampEndOffset) {
    return [
      { year: startYear, amount: rule.amount },
      { year: endYear, amount: rule.amount },
    ]
  }
  const rampEndYear = rule.rampEndOffset.months / 12
  if (rampEndYear >= endYear) {
    // The rule's own range ends before (or exactly as) the ramp finishes
    // - interpolate the amount at that cutoff instead of overshooting it.
    const span = rampEndYear - startYear
    const progress = span <= 0 ? 1 : (endYear - startYear) / span
    const amountAtEnd = rule.amount + (rule.endAmount - rule.amount) * Math.max(0, Math.min(1, progress))
    return [
      { year: startYear, amount: rule.amount },
      { year: endYear, amount: amountAtEnd },
    ]
  }
  return [
    { year: startYear, amount: rule.amount },
    { year: rampEndYear, amount: rule.endAmount },
    { year: endYear, amount: rule.endAmount },
  ]
}

interface AllocationPoint {
  year: number
  stocks: number
}

/** A single piecewise line tracking target stock allocation across the
 * whole strategy: flat until the first rebalance/glide-path rule, an
 * instant vertical step at each one-off rebalance, a sloped ramp across
 * each glide path's range, then flat again until the next event (or the
 * end of the strategy). Purely schematic - built from each rule's own
 * declared allocations, not a re-run of the simulation. */
function allocationTimeline(
  rules: StrategyRule[],
  initialAllocation: AllocationTarget,
  durationYears: number,
): AllocationPoint[] {
  const changeRules = (rules.filter((r) => r.type === 'rebalance' || r.type === 'glidePath') as (
    | RebalanceRule
    | GlidePathRule
  )[]).slice().sort((a, b) => a.startOffset.months - b.startOffset.months)

  const points: AllocationPoint[] = [{ year: 0, stocks: initialAllocation.stocks }]
  let currentYear = 0
  let currentStocks = initialAllocation.stocks

  for (const rule of changeRules) {
    const startYear = rule.startOffset.months / 12
    if (rule.type === 'rebalance') {
      if (startYear > currentYear) points.push({ year: startYear, stocks: currentStocks })
      points.push({ year: startYear, stocks: rule.targetAllocation.stocks })
      currentYear = startYear
      currentStocks = rule.targetAllocation.stocks
    } else {
      if (startYear > currentYear) points.push({ year: startYear, stocks: currentStocks })
      if (Math.abs(rule.startAllocation.stocks - currentStocks) > 1e-9) {
        points.push({ year: startYear, stocks: rule.startAllocation.stocks })
      }
      const endYear = rule.endOffset.months / 12
      points.push({ year: endYear, stocks: rule.endAllocation.stocks })
      currentYear = endYear
      currentStocks = rule.endAllocation.stocks
    }
  }

  if (currentYear < durationYears) points.push({ year: durationYears, stocks: currentStocks })
  return points
}

/** A single-track visual timeline of a strategy's rules across its
 * duration: contribution/withdrawal amounts as lines whose height tracks
 * their own relative value (rising/falling if the amount ramps), and
 * rebalance/glide-path rules merged into one target-allocation line
 * (instant steps for rebalances, ramps for glide paths). Purely
 * illustrative (not a data chart), so it skips axes/gridlines beyond a
 * light year ruler. */
export function RuleTimeline({
  rules,
  durationMonths,
  onSelectRule,
  initialAllocation,
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
  const hasAllocationRules = rules.some((r) => r.type === 'rebalance' || r.type === 'glidePath')
  const allocPoints = allocationTimeline(rules, initialAllocation, durationYears)

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <svg viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} className="w-full" role="img" aria-label="Strategy timeline">
        {/* Year ruler */}
        <line
          x1={MARGIN_X}
          x2={VIEW_WIDTH - MARGIN_X}
          y1={YEAR_RULER_Y}
          y2={YEAR_RULER_Y}
          stroke="var(--gridline)"
          strokeWidth={1}
        />
        {ticks.map((year) => (
          <g key={year}>
            <line
              x1={yearToX(year)}
              x2={yearToX(year)}
              y1={YEAR_RULER_Y - 4}
              y2={YEAR_RULER_Y + 4}
              stroke="var(--baseline)"
              strokeWidth={1}
            />
            <text x={yearToX(year)} y={LABEL_Y} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
              {currentAge != null ? `age ${currentAge + year}` : `yr ${year}`}
            </text>
          </g>
        ))}

        {/* Contribution / withdrawal amount lines */}
        {cashFlowRules.map((rule) => {
          const band = rule.type === 'contribution' ? CONTRIBUTION_BAND : WITHDRAWAL_BAND
          const pts = cashFlowPoints(rule, durationYears)
          const lo = Math.min(...pts.map((p) => p.amount))
          const hi = Math.max(...pts.map((p) => p.amount))
          const toY = (amount: number) => (hi - lo < 1e-9 ? band.center : bandY(band, (amount - lo) / (hi - lo)))
          const pxPoints = pts.map((p) => ({ x: yearToX(p.year), y: toY(p.amount) }))
          if (pxPoints[pxPoints.length - 1].x - pxPoints[0].x < 4) {
            pxPoints[pxPoints.length - 1].x = pxPoints[0].x + 4
          }
          return (
            <g key={rule.id} onClick={() => onSelectRule(rule.id)} className="cursor-pointer">
              <polyline
                points={pxPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={COLOR[rule.type]}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx={pxPoints[0].x}
                cy={pxPoints[0].y}
                r={4}
                fill="var(--surface-1)"
                stroke={COLOR[rule.type]}
                strokeWidth={2}
              />
            </g>
          )
        })}

        {/* Target allocation line (rebalance + glide path, unified) */}
        {hasAllocationRules && (
          <polyline
            points={allocPoints.map((p) => `${yearToX(p.year)},${bandY(ALLOCATION_BAND, p.stocks)}`).join(' ')}
            fill="none"
            stroke={COLOR.allocation}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {rules
          .filter((r) => r.type === 'rebalance' || r.type === 'glidePath')
          .map((rule) => {
            const x = yearToX(rule.startOffset.months / 12)
            const y =
              rule.type === 'rebalance'
                ? bandY(ALLOCATION_BAND, (rule as RebalanceRule).targetAllocation.stocks)
                : bandY(ALLOCATION_BAND, (rule as GlidePathRule).startAllocation.stocks)
            return (
              <circle
                key={rule.id}
                cx={x}
                cy={y}
                r={5}
                fill="var(--surface-1)"
                stroke={COLOR.allocation}
                strokeWidth={2}
                onClick={() => onSelectRule(rule.id)}
                className="cursor-pointer"
              />
            )
          })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        <LegendItem color={COLOR.contribution} label="Contribution" />
        <LegendItem color={COLOR.withdrawal} label="Withdrawal" />
        {hasAllocationRules && (
          <LegendItem color={COLOR.allocation} label="Target allocation (% stocks)" />
        )}
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
