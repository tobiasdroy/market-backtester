import { z } from 'zod'

const allocationTargetSchema = z
  .object({
    stocks: z.number().min(0).max(1),
    bonds: z.number().min(0).max(1),
    cash: z.number().min(0).max(1),
  })
  .refine((a) => Math.abs(a.stocks + a.bonds + a.cash - 1) < 1e-6, {
    message: 'allocation must sum to 1',
  })

const timeOffsetSchema = z.object({
  months: z.number().int().min(0),
})

const initialPortfolioSchema = z.object({
  startValue: z.number().min(0),
  allocation: allocationTargetSchema,
})

const cashFlowRuleSchema = z.object({
  id: z.string(),
  type: z.enum(['contribution', 'withdrawal']),
  startOffset: timeOffsetSchema,
  endOffset: timeOffsetSchema.optional(),
  amount: z.number().min(0),
  frequency: z.enum(['monthly', 'yearly']),
  inflationAdjusted: z.boolean(),
  endAmount: z.number().min(0).optional(),
  rampEndOffset: timeOffsetSchema.optional(),
})

const rebalanceRuleSchema = z.object({
  id: z.string(),
  type: z.literal('rebalance'),
  startOffset: timeOffsetSchema,
  targetAllocation: allocationTargetSchema,
})

const glidePathRuleSchema = z.object({
  id: z.string(),
  type: z.literal('glidePath'),
  startOffset: timeOffsetSchema,
  endOffset: timeOffsetSchema,
  startAllocation: allocationTargetSchema,
  endAllocation: allocationTargetSchema,
})

const strategyRuleSchema = z.discriminatedUnion('type', [
  cashFlowRuleSchema.extend({ type: z.literal('contribution') }),
  cashFlowRuleSchema.extend({ type: z.literal('withdrawal') }),
  rebalanceRuleSchema,
  glidePathRuleSchema,
])

const feesAndTaxSchema = z.object({
  annualFeePercent: z.number().min(0).max(1),
  accountType: z.enum(['ISA', 'GIA']),
  capitalGainsTaxRate: z.number().min(0).max(1).optional(),
})

export const strategySchema = z.object({
  id: z.string(),
  name: z.string(),
  initialPortfolio: initialPortfolioSchema,
  rules: z.array(strategyRuleSchema),
  durationMonths: z.number().int().min(1),
  contributionAllocation: z.enum(['proRata', 'lastTarget']).optional(),
  feesAndTax: feesAndTaxSchema.optional(),
})

export type StrategySchemaType = z.infer<typeof strategySchema>
