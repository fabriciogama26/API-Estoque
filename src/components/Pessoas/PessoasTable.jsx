import { PessoasActions } from './PessoasActions.jsx'
import { formatDate } from '../../utils/PessoasUtils.js'

export function PessoasTable({ pessoas, onEdit, onHistory, editingId, isSaving, historyState }) {
  if (!pessoas.length) {
    return <p className="feedback">Nenhuma pessoa cadastrada ainda.</p>
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Matricula</th>
            <th>Centro de servico</th>
            <th>Setor</th>
            <th>Cargo</th>
            <th>Data de admissao</th>
            <th>Tipo Execucao</th>
            <th>Registrado por</th>
            <th>Cadastrado em</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          {pessoas.map((pessoa) => (
            <tr key={pessoa.id}>
              <td>{pessoa.nome}</td>
              <td>{pessoa.matricula || '-'}</td>
              <td>{pessoa.centroServico ?? pessoa.local ?? '-'}</td>
              <td>{pessoa.setor || '-'}</td>
              <td>{pessoa.cargo || '-'}</td>
              <td>{formatDate(pessoa.dataAdmissao)}</td>
              <td>{pessoa.tipoExecucao || '-'}</td>
              <td>{pessoa.usuarioCadastro || '-'}</td>
              <td>{formatDate(pessoa.criadoEm)}</td>
              <td>
                <PessoasActions
                  pessoa={pessoa}
                  isEditing={editingId === pessoa.id}
                  isSaving={isSaving}
                  onEdit={onEdit}
                  onHistory={onHistory}
                  isHistoryLoading={historyState.isLoading && historyState.pessoa?.id === pessoa.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
