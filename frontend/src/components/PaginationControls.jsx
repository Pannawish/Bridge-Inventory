function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function PaginationControls({ pagination, onPageChange, itemLabel = "records" }) {
  if (!pagination || !pagination.count) {
    return null;
  }

  const page = Number(pagination.page || 1);
  const totalPages = Math.max(1, Number(pagination.total_pages || 1));
  const pageSize = Number(pagination.page_size || 0);
  const count = Number(pagination.count || 0);
  const start = pageSize ? (page - 1) * pageSize + 1 : 1;
  const end = pageSize ? Math.min(count, page * pageSize) : count;

  return (
    <div className="list-pagination">
      <span>
        Showing {formatNumber(start)}-{formatNumber(end)} of {formatNumber(count)} {itemLabel}
      </span>
      <div className="list-pagination-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => onPageChange?.(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="pagination-pill">
          Page {formatNumber(page)} of {formatNumber(totalPages)}
        </span>
        <button
          className="secondary-button"
          type="button"
          onClick={() => onPageChange?.(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default PaginationControls;
