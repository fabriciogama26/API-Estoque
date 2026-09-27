import { resolveStatusMeta } from '../../utils/validadesUtils.js'

export function ValidadeStatusChip({ status }) {
  const meta = resolveStatusMeta(status)
  return <span className={`status-chip validades-status-chip validades-status-chip--${meta.variant}`}>{meta.label}</span>
}
