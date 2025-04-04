'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { InboxEntry, Action } from '@/types';

interface EntryCardProps {
  entry: InboxEntry;
  onDelete: (id: string) => void;
  onUpdateAction: (id: string, data: { completed: boolean }) => void;
  onExecuteAction: (id: string) => void;
  renderAgentResults?: (action: Action) => React.ReactNode;
}

export default function EntryCard({ entry, onDelete, onUpdateAction, onExecuteAction, renderAgentResults }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  const pendingActions = entry.actions.filter(action => !action.completed).length;

  // Function to generate Gmail URL from message ID
  const getGmailUrl = (messageId: string) => {
    return `https://mail.google.com/mail/u/0/#inbox/${messageId}`;
  };

  // Function to toggle action details
  const toggleActionDetails = (actionId: string) => {
    if (expandedActionId === actionId) {
      setExpandedActionId(null);
    } else {
      setExpandedActionId(actionId);
    }
  };

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
          {entry.emailId && (
            <span className="ml-2">
              <a
                href={getGmailUrl(entry.emailId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700"
              >
                View in Gmail
              </a>
            </span>
          )}
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
                <div key={action.id} className="flex flex-col py-1">
                  <div className="flex flex-col w-full">
                    <div className="flex items-center w-full justify-between">
                      <div className="flex items-center flex-grow min-w-0 mr-2">
                        <input
                          type="checkbox"
                          checked={action.completed}
                          onChange={() => onUpdateAction(action.id, { completed: !action.completed })}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded flex-shrink-0"
                        />
                        <span className={`ml-2 text-sm ${action.completed ? 'line-through text-gray-400' : 'text-gray-700'} truncate max-w-full`}>
                          {action.description}
                        </span>
                      </div>
                      <div className="flex-shrink-0 flex space-x-2 items-center">
                        {action.metadata?.agentStatus && (
                          <button
                            onClick={() => toggleActionDetails(action.id)}
                            className={`text-xs px-2 py-1 rounded whitespace-nowrap ${action.metadata.agentStatus === 'running'
                              ? 'bg-yellow-100 text-yellow-800'
                              : action.metadata.agentStatus === 'completed'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                              }`}
                          >
                            {action.metadata.agentStatus === 'running' && 'Running...'}
                            {action.metadata.agentStatus === 'completed' && 'Completed'}
                            {action.metadata.agentStatus === 'error' && 'Error'}
                          </button>
                        )}
                        {!action.completed && !action.metadata?.agentStatus && (
                          <button
                            onClick={() => onExecuteAction(action.id)}
                            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors whitespace-nowrap"
                          >
                            Execute
                          </button>
                        )}
                        {!action.completed && action.metadata?.agentStatus === 'error' && (
                          <button
                            onClick={() => onExecuteAction(action.id)}
                            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors whitespace-nowrap"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    </div>

                    {action.dueDate && (
                      <div className="mt-1 ml-6">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          Due: {format(action.dueDate, 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Display agent result or error when expanded */}
                  {expandedActionId === action.id && action.metadata?.agentStatus && (
                    <div className="mt-2 ml-6 p-2 bg-gray-50 rounded text-sm">
                      {action.metadata.agentStatus === 'completed' && action.metadata.agentResult && (
                        <div>
                          {renderAgentResults ? (
                            renderAgentResults(action)
                          ) : (
                            <div>
                              <div className="font-semibold text-gray-900">Result:</div>
                              <div className="text-gray-900">{action.metadata.agentResult}</div>
                            </div>
                          )}
                        </div>
                      )}
                      {action.metadata.agentStatus === 'error' && action.metadata.agentError && (
                        <div>
                          <div className="font-semibold text-red-700">Error:</div>
                          <div className="text-red-700">{action.metadata.agentError}</div>
                        </div>
                      )}
                      {action.metadata.agentStatus === 'running' && (
                        <div className="text-yellow-700 font-medium flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-yellow-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          The agent is currently processing this action...
                        </div>
                      )}
                    </div>
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
