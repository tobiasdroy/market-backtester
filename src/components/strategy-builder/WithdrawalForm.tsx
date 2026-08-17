import type { CashFlowRule } from '@/engine/types'
import { CashFlowRuleForm } from './CashFlowRuleForm'

interface WithdrawalFormProps {
  initial?: CashFlowRule
  onSave: (rule: CashFlowRule) => void
  onCancel: () => void
}

export function WithdrawalForm(props: WithdrawalFormProps) {
  return <CashFlowRuleForm type="withdrawal" {...props} />
}
