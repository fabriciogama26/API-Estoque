import { InfoIcon } from '../icons.jsx'

// Explica por que um valor da politica de reposicao nao pode ser calculado.
// "consumo": sem nenhuma saida em 180 dias (minimo sugerido, consumo medio, cobertura).
// "limite": alem de sem saidas, o material tambem nao tem minimo cadastrado (minimo efetivo).
const TEXTOS = {
  consumo:
    'Sem informacao de consumo: este material nao teve nenhuma saida nos ultimos 180 dias. Sem saidas nao existe consumo medio para calcular o minimo sugerido nem a cobertura. Nao e consumo baixo nem falta de entradas; o estoque pode existir normalmente.',
  limite:
    'Sem informacao para definir o limite: o material nao tem minimo cadastrado e nao teve nenhuma saida nos ultimos 180 dias. Cadastre um minimo ou crie um override se o item precisar de estoque.',
}

export function NaoCalculavelInfo({ tipo = 'consumo' }) {
  const texto = TEXTOS[tipo] || TEXTOS.consumo
  return (
    <span className="nao-calculavel">
      <span>Nao calculavel</span>
      <button type="button" className="summary-tooltip summary-tooltip--inline" aria-label={texto}>
        <InfoIcon size={12} aria-hidden="true" />
        <span>{texto}</span>
      </button>
    </span>
  )
}
