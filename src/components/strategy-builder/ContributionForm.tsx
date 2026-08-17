import type { CashFlowRule } from '@/engine/types'
import { CashFlowRuleForm } from './CashFlowRuleForm'

interface ContributionFormProps {
  initial?: CashFlowRule
  onSave: (rule: CashFlowRule) => void
  onCancel: () => void
}

export function ContributionForm(props: ContributionFormProps) {
  return <CashFlowRuleForm type="contribution" {...props} />
}
