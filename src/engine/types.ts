export type AssetClass = 'stocks' | 'bonds' | 'cash'

export interface AllocationTarget {
  stocks: number
  bonds: number
  cash: number
}

export interface InitialPortfolio {
  startValue: number
  allocation: AllocationTarget
}

export interface TimeOffset {
  months: number
}

interface BaseRule {
  id: string
}

/** A recurring contribution or withdrawal.
 *
 * `startOffset`/`endOffset` are inclusive month offsets from the
 * simulation's start (month 0). Offset 0 is reserved for the initial
 * portfolio snapshot only, so `startOffset.months = 0` defers the first
 * firing to one full period later (offset 12 for yearly, offset 1 for
 * monthly) - the "add £X per year, starting a year from now" reading
 * used throughout the app. Any explicit non-zero `startOffset.months`
 * fires immediately at that offset instead (see simulate.ts:isRuleDue).
 */
export interface CashFlowRule extends BaseRule {
  type: 'contribution' | 'withdrawal'
  startOffset: TimeOffset
  endOffset?: TimeOffset
  /** In start-of-simulation GBP terms; see `inflationAdjusted`. */
  amount: number
  frequency: 'monthly' | 'yearly'
  /** When true, the applied amount is scaled by CPI(now)/CPI(start). */
  inflationAdjusted: boolean
}

/** A one-off reallocation to a new target mix, applied exactly at
 * `startOffset.months`. */
export interface RebalanceRule extends BaseRule {
  type: 'rebalance'
  startOffset: TimeOffset
  targetAllocation: AllocationTarget
}

/** Gradually shifts the target allocation from `startAllocation` to
 * `endAllocation` over `[startOffset, endOffset]`, rebalancing to the
 * linearly-interpolated mix every month in that range - e.g. a
 * multi-year de-risking glide path into retirement, rather than one
 * discrete jump. */
export interface GlidePathRule extends BaseRule {
  type: 'glidePath'
  startOffset: TimeOffset
  endOffset: TimeOffset
  startAllocation: AllocationTarget
  endAllocation: AllocationTarget
}

export type StrategyRule = CashFlowRule | RebalanceRule | GlidePathRule

/** Ongoing platform/fund fee and account-wrapper tax treatment. Optional
 * and omitted entirely by default (no fees, no tax) so existing
 * strategies keep behaving exactly as before. */
export interface FeesAndTax {
  /** Annual expense-ratio-style drag, e.g. 0.0075 for 0.75%/yr, applied
   * to every asset class every month regardless of account type. */
  annualFeePercent: number
  /** ISA: UK tax-free wrapper, no tax modeled. GIA (General Investment
   * Account): taxable - withdrawals are grossed up so the requested
   * amount is what you actually receive net of capital gains tax, using
   * a cost-basis approximation (see simulate.ts). Simplification: only
   * capital gains tax on withdrawals is modeled - dividend tax during
   * accumulation and the annual CGT exempt amount are not. */
  accountType: 'ISA' | 'GIA'
  /** Flat capital gains tax rate applied to the gain portion of each
   * withdrawal from a GIA. Ignored for ISA. */
  capitalGainsTaxRate?: number
}

export interface Strategy {
  id: string
  name: string
  initialPortfolio: InitialPortfolio
  rules: StrategyRule[]
  /** Total simulation horizon in months. */
  durationMonths: number
  /** How new contributions are split across asset classes.
   * `proRata` (default): proportional to current (drifted) balances.
   * `lastTarget`: proportional to the most recent rebalance's target
   * allocation (or the initial allocation if no rebalance has fired yet). */
  contributionAllocation?: 'proRata' | 'lastTarget'
  feesAndTax?: FeesAndTax
}

/** One month of market data for a single asset class. */
export interface MonthlyReturnPoint {
  date: string
  totalReturnIndex: number
  monthlyReturn: number
  source: string
  isInterpolated: boolean
  isSpliceStart?: boolean
}

export interface MonthlyInflationPoint {
  date: string
  cpiIndex: number
  source: string
  isInterpolated: boolean
  isSpliceStart?: boolean
}

export interface MarketDataRaw {
  stocks: MonthlyReturnPoint[]
  bonds: MonthlyReturnPoint[]
  cash: MonthlyReturnPoint[]
  inflation: MonthlyInflationPoint[]
}

/** One month, aligned across all series, as consumed by the engine. */
export interface MarketMonth {
  date: string
  monthlyReturn: Record<AssetClass, number>
  cpiIndex: number
}

/** The aligned, engine-ready market dataset (see dataLoader.ts). */
export interface MarketData {
  months: MarketMonth[]
  /** date ("YYYY-MM-01") -> index into `months` */
  indexByDate: Map<string, number>
}

export interface PortfolioSnapshot {
  date: string
  monthOffset: number
  totalValue: number
  byAsset: Record<AssetClass, number>
  cumulativeContributed: number
  cumulativeWithdrawn: number
  cumulativeFeesPaid: number
  cumulativeTaxPaid: number
  cpiIndex: number
  /** True once a withdrawal could not be fully paid because the
   * portfolio was exhausted. */
  depleted: boolean
}

export interface SimulationResult {
  strategyId: string
  startDate: string
  endDate: string
  snapshots: PortfolioSnapshot[]
}
