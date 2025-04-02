'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { InboxEntry } from '@/types';

interface EntryCardProps {
  entry: InboxEntry;
  onDelete: (id: string) => void;
  onUpdateAction: (id: string, data: { completed: boolean }) => void;
  onExecuteAction: (id: string) => void;
}

export default function EntryCard({ entry, onDelete, onUpdateAction, onExecuteAction }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const pendingActions = entry.actions.filter(action => !action.completed).length;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <h3 className="text-xl font-semibold text-gray-800 mb-2">{entry.title}</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-gray-500 hover:text-gray-700"
            >
              {expanded ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>
            <button
              onClick={() => onDelete(entry.id)}
              className="text-red-500 hover:text-red-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-3">
          Created: {format(entry.createdAt, 'MMM d, yyyy')}
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-medium text-gray-700">
              Actions: {entry.actions.length} ({pendingActions} pending)
            </div>
          </div>

          {entry.actions.length > 0 && (
            <div className="bg-gray-50 p-3 rounded">
              {entry.actions.slice(0, expanded ? entry.actions.length : 2).map(action => (
                <div key={action.id} className="flex items-center py-1">
                  <input
                    type="checkbox"
                    checked={action.completed}
                    onChange={() => onUpdateAction(action.id, { completed: !action.completed })}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className={`ml-2 text-sm ${action.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {action.description}
                  </span>
                  {action.dueDate && (
                    <span className="ml-auto text-xs text-gray-500">
                      Due: {format(action.dueDate, 'MMM d, yyyy')}
                    </span>
                  )}
                  {!action.completed && (
                    <button
                      onClick={() => onExecuteAction(action.id)}
                      className="ml-auto px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                    >
                      Execute
                    </button>
                  )}
                </div>
              ))}

              {!expanded && entry.actions.length > 2 && (
                <button
                  onClick={() => setExpanded(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 mt-1"
                >
                  Show {entry.actions.length - 2} more actions
                </button>
              )}
            </div>
          )}
        </div>

        {expanded && (
          <div className="mt-4 border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Content:</h4>
            <p className="text-gray-600 whitespace-pre-line">{entry.content}</p>
          </div>
        )}
      </div>
    </div>
  );
}
