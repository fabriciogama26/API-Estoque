import { MateriaisActions } from './MateriaisActions.jsx'
import { formatCurrency } from '../../utils/MateriaisUtils.js'

export function MateriaisTable({ materiais, onEdit, onHistory, editingId, isSaving, historyModal }) {
  if (!materiais.length) {
    return <p className="feedback">Nenhum material cadastrado.</p>
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Material</th>
            <th>CA</th>
            <th>Validade (dias)</th>
            <th>Valor unitario</th>
            <th>Fabricante</th>
            <th>Registrado por</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {materiais.map((material) => (
            <tr key={material.id}>
              <td>
                <strong>{material.nome}</strong>
              </td>
              <td>{material.ca || '-'}</td>
              <td>{material.validadeDias}</td>
              <td>{formatCurrency(material.valorUnitario)}</td>
              <td>{material.fabricante || '-'}</td>
              <td>{material.usuarioCadastro || '-'}</td>
              <td>
                <MateriaisActions
                  material={material}
                  isEditing={editingId === material.id}
                  isSaving={isSaving}
                  onEdit={onEdit}
                  onHistory={onHistory}
                  isHistoryLoading={historyModal.isLoading && historyModal.material?.id === material.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
