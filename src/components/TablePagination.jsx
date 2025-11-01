import { useMemo } from 'react'
import { TABLE_PAGE_SIZE } from '../config/pagination.js'
import '../styles/Pagination.css'

const DEFAULT_PAGE_SIZE = TABLE_PAGE_SIZE
const SIBLING_COUNT = 1

export function TablePagination({
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
  currentPage,
  onPageChange,
}) {
  const { totalPages, visiblePages } = useMemo(() => {
    const totalPagesCalc = Math.max(1, Math.ceil((totalItems ?? 0) / pageSize))

    const createVisiblePages = () => {
      if (totalPagesCalc <= 1) {
        return []
      }

      const pages = []
      const startPage = Math.max(2, currentPage - SIBLING_COUNT)
      const endPage = Math.min(totalPagesCalc - 1, currentPage + SIBLING_COUNT)

      pages.push(1)

      if (startPage > 2) {
        pages.push('ellipsis-start')
      }

      for (let page = startPage; page <= endPage; page += 1) {
        if (page >= 2 && page <= totalPagesCalc - 1) {
          pages.push(page)
        }
      }

      if (endPage < totalPagesCalc - 1) {
        pages.push('ellipsis-end')
      }

      if (totalPagesCalc > 1) {
        pages.push(totalPagesCalc)
      }

      return pages
    }

    return {
      totalPages: totalPagesCalc,
      visiblePages: createVisiblePages(),
    }
  }, [currentPage, pageSize, totalItems])

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages || page === currentPage) {
      return
    }
    onPageChange?.(page)
  }

  if (totalPages <= 1) {
    return null
  }

  return (
    <nav className="table-pagination" aria-label="Paginacao da tabela">
      <button
        type="button"
        className="table-pagination__button"
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        Anterior
      </button>
      {visiblePages.map((page, index) => {
        if (typeof page === 'string') {
          return (
            <span key={page + index} className="table-pagination__ellipsis" aria-hidden="true">
              ...
            </span>
          )
        }

        return (
          <button
            key={page}
            type="button"
            className={`table-pagination__button${page === currentPage ? ' table-pagination__button--active' : ''}`}
            onClick={() => handlePageChange(page)}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        )
      })}
      <button
        type="button"
        className="table-pagination__button"
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        Proxima
      </button>
    </nav>
  )
}

