import { useEffect, useMemo, useState } from 'react'
import { HISTORY_PAGE_SIZE } from '../config/pagination.js'

export function useHistoryPagination(items, pageSize = HISTORY_PAGE_SIZE) {
  const totalItems = Array.isArray(items) ? items.length : 0
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [totalItems])

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize

  const pageItems = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) {
      return []
    }
    return items.slice(startIndex, startIndex + pageSize)
  }, [items, pageSize, startIndex])

  return {
    pageItems,
    currentPage,
    totalItems,
    pageSize,
    totalPages,
    startIndex,
    setPage,
  }
}
