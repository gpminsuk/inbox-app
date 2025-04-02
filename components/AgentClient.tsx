'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

type Log = {
  id: string;
  message: string;
  level: string;
  source: string;
  timestamp: string;
  userId: string | null;
};

type Pagination = {
  total: number;
  limit: number;
  nextCursor: string | null;
  hasMore: boolean;
};

export default function AgentClient() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    limit: 50,
    nextCursor: null,
    hasMore: false,
  });
  const [filter, setFilter] = useState({
    source: '',
    level: '',
  });

  // Reference to the logs container for scrolling
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch logs
  const fetchLogs = async (cursor?: string) => {
    if (!session) return;

    setIsLoading(true);
    setError(null);

    try {
      // Build query string
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
      });

      if (cursor) params.append('before', cursor);
      if (filter.source) params.append('source', filter.source);
      if (filter.level) params.append('level', filter.level);

      const response = await fetch(`/api/logs?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();

      if (cursor) {
        // Prepend older logs to the beginning
        setLogs(prevLogs => [...data.logs, ...prevLogs]);
      } else {
        // Initial load
        setLogs(data.logs);
      }

      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching logs:', err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  // Load more logs (older logs)
  const handleLoadMore = async () => {
    if (!pagination.nextCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    await fetchLogs(pagination.nextCursor);
  };

  // Handle filter change
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilter(prev => ({ ...prev, [name]: value }));
  };

  // Apply filters
  const applyFilters = () => {
    fetchLogs();
  };

  // Fetch logs on mount
  useEffect(() => {
    if (session) {
      fetchLogs();
    }
  }, [session]);

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Get CSS class for log level
  const getLevelClass = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
            Log Level
          </label>
          <select
            id="level"
            name="level"
            value={filter.level}
            onChange={handleFilterChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div>
          <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
            Source
          </label>
          <select
            id="source"
            name="source"
            value={filter.source}
            onChange={handleFilterChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            <option value="">All Sources</option>
            <option value="email-processor">Email Processor</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={applyFilters}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Loading state for initial load */}
      {isLoading && !isLoadingMore ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600">Loading logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No logs found</p>
        </div>
      ) : (
        <div>
          {/* Load Previous button */}
          {pagination.hasMore && (
            <div className="text-center mb-4">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {isLoadingMore ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-t-2 border-b-2 border-indigo-600"></div>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Load Previous Logs
                  </>
                )}
              </button>
            </div>
          )}

          {/* Logs table */}
          <div className="overflow-x-auto" ref={logsContainerRef}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Level
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getLevelClass(log.level)} bg-${log.level === 'error' ? 'red' : log.level === 'warning' ? 'yellow' : 'blue'}-100`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="mt-4 text-sm text-gray-500">
            Showing {logs.length} of {pagination.total} logs
          </div>
        </div>
      )}
    </div>
  );
}
