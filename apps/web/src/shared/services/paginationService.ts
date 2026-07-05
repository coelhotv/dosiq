/**
 * Pagination service to handle infinite scrolling and lazy loading
 */

const DEFAULT_PAGE_SIZE = 50

export const paginationService = {
  /**
   * Calculate offset from page number
   */
  getOffset: (pageNumber, pageSize = DEFAULT_PAGE_SIZE) => {
    return (pageNumber - 1) * pageSize
  },

  /**
   * Parse pagination metadata from API response
   */
  parsePaginationMeta: (response) => {
    return {
      total: response.total || 0,
      page: response.page || 1,
      pageSize: response.pageSize || DEFAULT_PAGE_SIZE,
      hasMore: response.hasMore !== false,
      totalPages: Math.ceil((response.total || 0) / (response.pageSize || DEFAULT_PAGE_SIZE)),
    }
  },

  /**
   * Calculate if we should fetch more
   */
  shouldFetchMore: (currentItems, total) => {
    return currentItems.length < total
  },
}
