import React from "react";

interface PaginationProps {
  count: number;
  pageSize: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  darkMode?: boolean;
  siblingCount?: number;
}

const SmartPagination: React.FC<PaginationProps> = ({
  count,
  pageSize,
  currentPage,
  onPageChange,
  darkMode = false,
  siblingCount = 1,
}) => {
  const totalPages = Math.ceil(count / pageSize);
  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const totalNumbers = siblingCount * 2 + 5;

    if (totalPages <= totalNumbers) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 2);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages - 1);

    pages.push(1);

    if (leftSiblingIndex > 2) pages.push("...");

    for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
      pages.push(i);
    }

    if (rightSiblingIndex < totalPages - 1) pages.push("...");

    pages.push(totalPages);

    return pages;
  };

  const pages = getPageNumbers();

  return (
    <div className={`flex items-center space-x-2 mt-4 justify-center ${darkMode ? "bg-gray-800 text-white p-2 rounded" : "bg-gray-100 text-gray-800 p-2 rounded"}`}>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`px-3 py-1 rounded ${darkMode ? "bg-gray-700 hover:bg-gray-600 disabled:opacity-50" : "bg-white hover:bg-gray-200 disabled:opacity-50"}`}
      >
        Prev
      </button>

      {pages.map((page, idx) =>
        page === "..." ? (
          <span key={idx} className="px-3 py-1">
            ...
          </span>
        ) : (
          <button
            key={idx}
            onClick={() => onPageChange(Number(page))}
            className={`px-3 py-1 rounded ${page === currentPage
                ? darkMode
                  ? "bg-blue-600 text-white"
                  : "bg-blue-500 text-white"
                : darkMode
                  ? "bg-gray-700 hover:bg-gray-600"
                  : "bg-white hover:bg-gray-200"
              }`}
          >
            {page}
          </button>
        )
      )}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`px-3 py-1 rounded ${darkMode ? "bg-gray-700 hover:bg-gray-600 disabled:opacity-50" : "bg-white hover:bg-gray-200 disabled:opacity-50"}`}
      >
        Next
      </button>
    </div>
  );
};

export default SmartPagination;
