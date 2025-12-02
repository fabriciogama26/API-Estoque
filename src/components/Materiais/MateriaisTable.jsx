import { useEffect, useMemo, useState } from 'react'
import { MateriaisActions } from './MateriaisActions.jsx'
import { TablePagination } from '../TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../../config/pagination.js'
import { formatCurrency } from '../../utils/MateriaisUtils.js'

const SPLIT_PATTERN = /[\n;,]/

const normalizeDisplayValue = (value) => {
  if (!value) {
    return []
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (!item) {
          return null
        }
        if (typeof item === 'string') {
          return item.trim()
        }
        if (typeof item === 'object') {
          const nome =
            (typeof item.nome === 'string' && item.nome.trim()) ||
            (typeof item.name === 'string' && item.name.trim()) ||
            (typeof item.label === 'string' && item.label.trim()) ||
            (typeof item.valor === 'string' && item.valor.trim()) ||
            (typeof item.value === 'string' && item.value.trim())
          return nome || null
        }
        return null
      })
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(SPLIT_PATTERN)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'object') {
    const nome =
      (typeof value.nome === 'string' && value.nome.trim()) ||
      (typeof value.name === 'string' && value.name.trim()) ||
      (typeof value.label === 'string' && value.label.trim()) ||
      (typeof value.valor === 'string' && value.valor.trim()) ||
      (typeof value.value === 'string' && value.value.trim())
    return nome ? [nome] : []
  }

  return []
}

const collectUniqueValues = (...sources) => {
  const seen = new Set()
  const resultado = []

  sources.forEach((source) => {
    normalizeDisplayValue(source).forEach((item) => {
      const texto = item.trim()
      if (!texto) {
        return
      }
      const chave = texto.toLowerCase()
      if (!seen.has(chave)) {
        seen.add(chave)
        resultado.push(texto)
      }
    })
  })

  return resultado
}

const renderMultiValue = (valores) => {
  if (!valores.length) {
    return <span>-</span>
  }

  return (
    <div className="materiais-table__tags">
      {valores.map((item, index) => (
        <span key={`${item}-${index}`} className="materiais-table__tag">
          {item}
        </span>
      ))}
    </div>
  )
}

const PAGE_SIZE = TABLE_PAGE_SIZE

export function MateriaisTable({ materiais, onEdit, onHistory, editingId, isSaving, historyModal }) {
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(materiais.length / PAGE_SIZE))
    setCurrentPage((prev) => {
      if (prev < 1) {
        return 1
      }
      if (prev > totalPages) {
        return totalPages
      }
      return prev
    })
  }, [materiais.length])

  const paginatedMateriais = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return materiais.slice(startIndex, startIndex + PAGE_SIZE)
  }, [materiais, currentPage])

  if (!materiais.length) {
    return <p className="feedback">Nenhum material cadastrado.</p>
  }

  return (
    <>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Grupo</th>
              <th>Tamanho</th>
              <th>Cores</th>
              <th>Características</th>
              <th>Descrição</th>
              <th>CA</th>
              <th>Validade (dias)</th>
              <th>Valor unitario</th>
              <th>Fabricante</th>
              <th>Registrado por</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMateriais.map((material) => (
              <tr key={material.id}>
                <td>
                  <strong>{material.nomeItemRelacionado || '-'}</strong>
                </td>
                <td>{material.grupoMaterialNome || material.grupoMaterial || '-'}</td>
                <td>
                  {material.numeroCalcadoNome ||
                    material.numeroVestimentaNome ||
                    material.numeroCalcado ||
                    material.numeroVestimenta ||
                    '-'}
                </td>
                <td>
                  {renderMultiValue(
                    collectUniqueValues(
                      material.cores,
                      material.coresNomes,
                      material.coresTexto,
                      material.corMaterial,
                    ),
                  )}
                </td>
                <td>
                  {renderMultiValue(
                    collectUniqueValues(
                      material.caracteristicas,
                      material.caracteristicasNomes,
                      material.caracteristicasTexto,
                      material.caracteristicaEpi,
                    ),
                  )}
                </td>
                <td>
                  {material.descricao?.trim() ? (
                    <span className="materiais-table__description">{material.descricao.trim()}</span>
                  ) : (
                    '-' 
                  )}
                </td>
                <td>{material.ca || '-'}</td>
                <td>{material.validadeDias}</td>
                <td>{formatCurrency(material.valorUnitario)}</td>
                <td>{material.fabricanteNome || material.fabricante || '-'}</td>
                <td>
                  {material.usuarioCadastroUsername ||
                    material.registradoPor ||
                    material.usuarioCadastroNome ||
                    material.usuarioCadastro ||
                    '-'}
                </td>
                <td>
                  <MateriaisActions
                    material={material}
                    isEditing={editingId === material.id}
                    isSaving={isSaving}
                    onEdit={onEdit}
                    onHistory={onHistory}
                    isHistoryLoading={
                      historyModal.isLoading && historyModal.material?.id === material.id
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        totalItems={materiais.length}
        pageSize={PAGE_SIZE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  )
}

