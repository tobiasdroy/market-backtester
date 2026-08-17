import { simulateRolling } from './rollingBacktest'
import type { MarketData, Strategy, StrategyRule } from './types'

/** Which numeric knob a sensitivity sweep varies. `ruleAmount` targets a
 * specific contribution/withdrawal rule's `amount` field by id. */
export type SensitivityTarget =
  | { kind: 'startValue' }
  | { kind: 'annualFeePercent' }
  | { kind: 'ruleAmount'; ruleId: string }

export interface SensitivityPoint {
  paramValue: number
  endingValueMedianNominal: number
  endingValueMedianReal: number
  successRate: number
}

export interface SensitivityResult {
  target: SensitivityTarget
  points: SensitivityPoint[]
}

export interface SensitivityOptions {
  /** Rolling-backtest granularity for each swept variant. */
  stepMonths?: number
  onProgress?: (done: number, total: number) => void
}

/** Returns a copy of `strategy` with the target field set to `value`. */
export function applySensitivityValue(
  strategy: Strategy,
  target: SensitivityTarget,
  value: number,
): Strategy {
  switch (target.kind) {
    case 'startValue':
      return {
        ...strategy,
        initialPortfolio: { ...strategy.initialPortfolio, startValue: value },
      }
    case 'annualFeePercent':
      return {
        ...strategy,
        feesAndTax: { accountType: 'ISA', ...strategy.feesAndTax, annualFeePercent: value },
      }
    case 'ruleAmount':
      return {
        ...strategy,
        rules: strategy.rules.map((rule): StrategyRule =>
          rule.id === target.ruleId && rule.type !== 'rebalance' ? { ...rule, amount: value } : rule,
        ),
      }
  }
}

/** Re-runs a rolling backtest once per value in `values`, varying only
 * `target` each time, and reports the median ending value + success rate
 * for each - "if I change X, how does the robust historical outcome
 * move?" Uses rolling (not a single start date) so the answer isn't an
 * artifact of one particular historical sequence. */
export function runSensitivity(
  strategy: Strategy,
  marketData: MarketData,
  target: SensitivityTarget,
  values: number[],
  options: SensitivityOptions = {},
): SensitivityResult {
  const points: SensitivityPoint[] = values.map((value, i) => {
    const variant = applySensitivityValue(strategy, target, value)
    const rolling = simulateRolling(variant, marketData, { stepMonths: options.stepMonths ?? 12 })
    options.onProgress?.(i + 1, values.length)
    return {
      paramValue: value,
      endingValueMedianNominal: rolling.endingValuePercentiles[50] ?? 0,
      endingValueMedianReal: rolling.endingValuePercentilesReal[50] ?? 0,
      successRate: rolling.successRate,
    }
  })

  return { target, points }
}

/** Builds `steps` evenly-spaced values from `min` to `max` inclusive (e.g.
 * min=700, max=1300, steps=5 -> [700, 850, 1000, 1150, 1300]). An absolute
 * range rather than +/-% of a base value, since a base of 0 (e.g. no fee
 * configured yet) would otherwise degenerate to an all-zero sweep. */
export function buildSweepValues(min: number, max: number, steps: number): number[] {
  if (steps <= 1) return [min]
  return Array.from({ length: steps }, (_, i) => min + ((max - min) * i) / (steps - 1))
}
