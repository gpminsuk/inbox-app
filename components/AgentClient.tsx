'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

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
  nextCursor?: string;
};

export default function AgentClient() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    limit: 10,
  });
  const [filter, setFilter] = useState({
    source: '',
    level: '',
  });
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Fetch logs - handles both initial load and loading more
  const fetchLogs = async (initial: boolean = false) => {
    if (!session) return;

    setIsLoading(true);
    setError(null);

    if (initial || !pagination.nextCursor) {
      setLogs([]);
      // Reset cursor when doing an initial load
      setPagination(prev => ({ ...prev, nextCursor: undefined }));
    }

    try {
      // Build query string
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
      });

      // Add filter parameters if set
      if (filter.source) params.append('source', filter.source);
      if (filter.level) params.append('level', filter.level);

      // Add cursor for "Load More" functionality
      if (pagination.nextCursor) {
        params.append('before', pagination.nextCursor);
      }

      const response = await fetch(`/api/logs?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }

      const data = await response.json();
      console.log('Fetched logs:', data);

      // Add new logs to the beginning of the array (older logs first)
      setLogs(prev => [...data.logs, ...prev]);

      // Update pagination info
      setPagination(prev => ({
        ...prev,
        total: data.total,
        nextCursor: data.nextCursor,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilter(prev => ({ ...prev, [name]: value }));
    // Reset and do an initial load when filter changes
    fetchLogs(true);
  };

  // Fetch logs on mount
  useEffect(() => {
    fetchLogs(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // Scroll to bottom of logs after initial load
  useEffect(() => {
    if (!isLoading && logs.length > 0 && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [isLoading, logs]);

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
            onClick={() => fetchLogs(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-gray-600">Loading logs...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No logs found</p>
        </div>
      ) : (
        <>
          {/* Logs table */}
          <div
            ref={logsContainerRef}
            className="overflow-x-auto max-h-[70vh] overflow-y-auto"
          >
            {/* Load More button at the top */}
            {pagination.nextCursor && (
              <div className="sticky top-0 z-10 bg-white py-2 text-center border-b">
                <button
                  onClick={() => fetchLogs()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Load Previous Logs'}
                </button>
              </div>
            )}

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
        </>
      )}
    </div>
  );
}
