import {
  formatDateTimeFullPreserve,
  formatDateWithOptionalTime,
  formatNumberValue,
  formatStatusWithDate,
  normalizeText,
  parseList,
} from '../../../utils/acidentesUtils.js'

function DetailItem({ label, value, muted = false }) {
  const hasValue = value !== null && value !== undefined && value !== ''
  const display = hasValue ? value : '-'
  const className = `acidente-details__value${muted ? ' acidente-details__value--muted' : ''}`

  return (
    <div className="acidente-details__item">
      <span className="acidente-details__label">{label}</span>
      <p className={className}>{display}</p>
    </div>
  )
}

export function AcidenteDetailsModal({ open, acidente, onClose }) {
  if (!open || !acidente) {
    return null
  }

  const stopPropagation = (event) => {
    event.stopPropagation()
  }

  const toListText = (value) => {
    const lista = parseList(value)
    return lista.length ? lista.join(', ') : '-'
  }

  const agentesTexto = toListText(acidente.agentes?.length ? acidente.agentes : acidente.agente)
  const tiposTexto = toListText(acidente.tipos?.length ? acidente.tipos : acidente.tipo)
  const lesoesTexto = toListText(acidente.lesoes?.length ? acidente.lesoes : acidente.lesao)
  const partesTexto = toListText(
    Array.isArray(acidente.partesLesionadas) && acidente.partesLesionadas.length
      ? acidente.partesLesionadas
      : acidente.parteLesionada
  )

  const dataCriacao =
    acidente.criadoEm ?? acidente.criado_em ?? acidente.createdAt ?? acidente.created_at ?? null
  const dataAtualizacao =
    acidente.atualizadoEm ?? acidente.atualizado_em ?? acidente.updatedAt ?? acidente.updated_at ?? null
  const registradoPor =
    acidente.registradoPor ?? acidente.usuarioCadastroNome ?? acidente.usuarioCadastro ?? '-'
  const atualizadoPor =
    acidente.atualizadoPor ?? acidente.usuarioAtualizacaoNome ?? acidente.usuarioAtualizacao ?? '-'
  const observacaoTexto = normalizeText(acidente.observacao)

  return (
    <div className="acidente-details__overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="acidente-details__modal" onClick={stopPropagation}>
        <header className="acidente-details__header">
          <div>
            <p className="acidente-details__eyebrow">ID do cadastro</p>
            <h3 className="acidente-details__title">{acidente.id || 'ID nao informado'}</h3>
            <p className="acidente-details__meta">
            </p>
          </div>
          <button
            type="button"
            className="acidente-details__close"
            onClick={onClose}
            aria-label="Fechar detalhes do acidente"
          >
            x
          </button>
        </header>

        <div className="acidente-details__section">
          <h4 className="acidente-details__section-title">Dados principais</h4>
          <div className="acidente-details__grid">
            <DetailItem label="Nome" value={acidente.nome} />
            <DetailItem label="Matricula" value={acidente.matricula} />
            <DetailItem label="Cargo" value={acidente.cargo} />
            <DetailItem label="Data do acidente" value={formatDateWithOptionalTime(acidente.data)} />
            <DetailItem label="Centro de servico" value={acidente.centroServico || acidente.setor} />
            <DetailItem label="Local" value={acidente.local || acidente.centroServico || acidente.setor} />
            <DetailItem label="CID" value={acidente.cid} />
            <DetailItem label="CAT" value={acidente.cat} />
          </div>
        </div>

        <div className="acidente-details__section">
          <h4 className="acidente-details__section-title">Classificacao</h4>
          <div className="acidente-details__grid">
            <DetailItem label="Agente" value={agentesTexto} />
            <DetailItem label="Tipo" value={tiposTexto} />
            <DetailItem label="Lesoes" value={lesoesTexto} />
            <DetailItem label="Partes lesionadas" value={partesTexto} />
          </div>
        </div>

        <div className="acidente-details__section">
          <h4 className="acidente-details__section-title">Impactos e registro</h4>
          <div className="acidente-details__grid">
            <DetailItem label="Dias perdidos" value={formatNumberValue(acidente.diasPerdidos)} />
            <DetailItem label="Dias debitados" value={formatNumberValue(acidente.diasDebitados)} />
            <DetailItem label="Status" value={acidente.ativo === false ? 'Cancelado' : 'Ativo'} />
            <DetailItem
              label="Lancado eSOCIAL"
              value={formatStatusWithDate(Boolean(acidente.dataEsocial), acidente.dataEsocial)}
            />
            <DetailItem
              label="Lancado SESMT"
              value={formatStatusWithDate(Boolean(acidente.sesmt), acidente.dataSesmt)}
            />
            <DetailItem label="Registrado por" value={registradoPor} />
            <DetailItem
              label="Cadastrado em"
              value={dataCriacao ? formatDateTimeFullPreserve(dataCriacao) : '-'}
            />
            <DetailItem
              label="Atualizado por"
              value={atualizadoPor || '-'}
              muted={!atualizadoPor || atualizadoPor === '-'}
            />
            <DetailItem
              label="Atualizado em"
              value={dataAtualizacao ? formatDateTimeFullPreserve(dataAtualizacao) : '-'}
              muted={!dataAtualizacao}
            />
          </div>
        </div>

        <div className="acidente-details__section">
          <h4 className="acidente-details__section-title">Observacao</h4>
          <div className="acidente-details__text-block">
            {observacaoTexto ? observacaoTexto : 'Nenhuma observacao informada.'}
          </div>
        </div>
      </div>
    </div>
  )
}
