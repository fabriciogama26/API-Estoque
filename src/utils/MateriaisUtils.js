
// Formatação e manipulação de valores monetários
const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
})

// Formata número para moeda brasileira (R$ 0,00)
export function formatCurrency(value) {
  return currencyFormatter.format(Number(value ?? 0))
}

// Remove tudo que não for dígito
export function sanitizeDigits(value = '') {
  return String(value).replace(/\D/g, '')
}

// Formata input de moeda enquanto o usuário digita
export function formatCurrencyInput(value) {
  const digits = sanitizeDigits(value)
  if (!digits) {
    return ''
  }
  const amount = Number(digits) / 100
  return currencyFormatter.format(amount)
}

// Converte valor formatado em moeda para número (R$ 0,00 -> 0.00)
export function parseCurrencyToNumber(value) {
  const digits = sanitizeDigits(value)
  if (!digits) {
    return 0
  }
  return Number(digits) / 100
}
