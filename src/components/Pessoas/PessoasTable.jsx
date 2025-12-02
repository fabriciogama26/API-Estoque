import { useEffect, useMemo, useState } from 'react'
import { PessoasActions } from './PessoasActions.jsx'
import { TablePagination } from '../TablePagination.jsx'
import { TABLE_PAGE_SIZE } from '../../config/pagination.js'
import { formatDate } from '../../utils/pessoasUtils.js'

const PAGE_SIZE = TABLE_PAGE_SIZE

export function PessoasTable({ pessoas, onEdit, onHistory, editingId, isSaving, historyState }) {
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(pessoas.length / PAGE_SIZE))
    setCurrentPage((prev) => {
      if (prev < 1) {
        return 1
      }
      if (prev > totalPages) {
        return totalPages
      }
      return prev
    })
  }, [pessoas.length])

  const paginatedPessoas = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE
    return pessoas.slice(startIndex, startIndex + PAGE_SIZE)
  }, [pessoas, currentPage])

  if (!pessoas.length) {
    return <p className="feedback">Nenhuma pessoa cadastrada ainda.</p>
  }

  return (
    <>
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
              <th>Status</th>
              <th>Registrado por</th>
              <th>Cadastrado em</th>
              <th>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPessoas.map((pessoa) => (
              <tr key={pessoa.id}>
                <td>{pessoa.nome}</td>
                <td>{pessoa.matricula || '-'}</td>
                <td>{pessoa.centroServico ?? pessoa.local ?? '-'}</td>
                <td>{pessoa.setor || '-'}</td>
                <td>{pessoa.cargo || '-'}</td>
                <td>{formatDate(pessoa.dataAdmissao)}</td>
                <td>{pessoa.tipoExecucao || '-'}</td>
                <td>{pessoa.ativo === false ? 'Inativo' : 'Ativo'}</td>
                <td>{pessoa.usuarioCadastroNome || pessoa.usuarioCadastroUsername || pessoa.usuarioCadastro || '-'}</td>
                <td>{formatDate(pessoa.criadoEm)}</td>
                <td>
                  <PessoasActions
                    pessoa={pessoa}
                    isEditing={editingId === pessoa.id}
                    isSaving={isSaving}
                    onEdit={onEdit}
                    onHistory={onHistory}
                    isHistoryLoading={
                      historyState.isLoading && historyState.pessoa?.id === pessoa.id
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <TablePagination
        totalItems={pessoas.length}
        pageSize={PAGE_SIZE}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
    </>
  )
}
