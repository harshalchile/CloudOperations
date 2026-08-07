import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, SlidersHorizontal, Download, RefreshCw, CheckSquare, Square } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';

export const DataTable = ({
  columns = [],
  data = [],
  searchPlaceholder = 'Filter records...',
  bulkActions,
  onRowClick,
}) => {
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Search Filter
  const filteredData = data.filter((row) =>
    columns.some((col) => {
      const val = row[col.accessor];
      return val && String(val).toLowerCase().includes(search.toLowerCase());
    })
  );

  // Sorting
  const sortedData = [...filteredData].sort((a, b) => {
    if (!sortColumn) return 0;
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = sortedData.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (accessor) => {
    if (sortColumn === accessor) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(accessor);
      setSortDirection('asc');
    }
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === paginatedData.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginatedData.map((d) => d.id || d.name)));
    }
  };

  const toggleSelectRow = (id) => {
    const next = new Set(selectedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRows(next);
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg shadow-sm overflow-hidden">
      {/* Top Bar: Search, Bulk Actions, Density */}
      <div className="p-3 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500/60 font-mono-tabular"
            />
          </div>

          {selectedRows.size > 0 && bulkActions && (
            <div className="flex items-center gap-2 px-2 py-1 bg-blue-600/10 border border-blue-500/30 rounded text-xs text-blue-300">
              <span className="font-semibold">{selectedRows.size} selected</span>
              {bulkActions}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end text-xs text-slate-400">
          <span className="font-mono-tabular">
            Showing {paginatedData.length} of {filteredData.length} records
          </span>
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900/90 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider select-none">
              <th className="p-3 w-10 text-center">
                <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-300">
                  {selectedRows.size > 0 && selectedRows.size === paginatedData.length ? (
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
              </th>
              {columns.map((col) => (
                <th
                  key={col.accessor}
                  onClick={() => col.sortable !== false && handleSort(col.accessor)}
                  className={`p-3 font-mono-tabular ${col.sortable !== false ? 'cursor-pointer hover:text-slate-200' : ''}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {sortColumn === col.accessor && (
                      sortDirection === 'asc' ? <ChevronUp className="w-3 h-3 text-blue-400" /> : <ChevronDown className="w-3 h-3 text-blue-400" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200 font-mono-tabular">
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="p-8 text-center text-slate-500 text-xs">
                  No records match your criteria.
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => {
                const rowId = row.id || row.name || idx;
                const isSelected = selectedRows.has(rowId);

                return (
                  <tr
                    key={rowId}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`hover:bg-slate-800/50 transition-colors ${isSelected ? 'bg-blue-600/10' : ''} ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => toggleSelectRow(rowId)} className="text-slate-500 hover:text-slate-300">
                        {isSelected ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    </td>
                    {columns.map((col) => {
                      const value = row[col.accessor];
                      return (
                        <td key={col.accessor} className="p-3 whitespace-nowrap">
                          {col.cell ? (
                            col.cell(row)
                          ) : col.isStatus ? (
                            <StatusBadge status={value} />
                          ) : (
                            <span className="text-slate-300">{value ?? '—'}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 bg-slate-900/60 font-mono-tabular">
        <div>
          Page <span className="text-white font-semibold">{page}</span> of{' '}
          <span className="text-white font-semibold">{totalPages}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
