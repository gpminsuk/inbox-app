'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EntryCard from './EntryCard';
import { InboxEntry, Action, AgentHistoryList, AgentActionResult } from '@/types';

type InboxClientProps = {
  initialEntries: InboxEntry[];
};

export default function InboxClient({ initialEntries }: InboxClientProps) {
  const [entries, setEntries] = useState<InboxEntry[]>(initialEntries);
  const [loading, setLoading] = useState(false);
  const [pollingActions, setPollingActions] = useState<string[]>([]);
  const [customAgentPrompt, setCustomAgentPrompt] = useState<string>('');
  const router = useRouter();

  // Fetch entries on component mount
  useEffect(() => {
    if (initialEntries.length === 0) {
      fetchEntries();
    }

    // Fetch the user's custom agent prompt
    fetchCustomAgentPrompt();
  }, [initialEntries.length]);

  // Fetch the user's custom agent prompt from settings
  const fetchCustomAgentPrompt = async () => {
    try {
      const response = await fetch('/api/settings/agent-prompt');
      if (response.ok) {
        const data = await response.json();
        setCustomAgentPrompt(data.customAgentPrompt || '');
      }
    } catch (error) {
      console.error('Error fetching custom agent prompt:', error);
    }
  };

  const fetchEntries = async () => {
    try {
      const response = await fetch('/api/inbox');
      if (!response.ok) {
        throw new Error('Failed to fetch entries');
      }
      const data = await response.json();
      setEntries(data);

      // Check for any actions that are in 'running' state and add them to polling
      const runningActions: string[] = [];
      data.forEach((entry: InboxEntry) => {
        entry.actions.forEach(action => {
          if (action.metadata?.agentStatus === 'running') {
            runningActions.push(action.id);
          }
        });
      });

      if (runningActions.length > 0) {
        setPollingActions(runningActions);
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Poll for action status updates
  useEffect(() => {

    const checkActionStatus = async (actionId: string) => {
      try {
        const response = await fetch(`/api/agent/run?actionId=${actionId}`);
        if (!response.ok) {
          return;
        }

        const actionData = await response.json();

        // If the action is no longer running, update it and remove from polling
        if (actionData.metadata?.agentStatus !== 'running') {
          // Update the entries state with the updated action
          setEntries(entries.map(entry => {
            if (entry.actions.some(action => action.id === actionId)) {
              return {
                ...entry,
                actions: entry.actions.map(action =>
                  action.id === actionId ? { ...action, ...actionData } : action
                )
              };
            }
            return entry;
          }));

          // Remove from polling list
          setPollingActions(prev => prev.filter(id => id !== actionId));
        }
      } catch (error) {
        console.error('Error checking action status:', error);
      }
    };

    if (pollingActions.length === 0) return;

    const intervalId = setInterval(() => {
      pollingActions.forEach(actionId => {
        checkActionStatus(actionId);
      });
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(intervalId);
  }, [pollingActions, entries]);

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const response = await fetch(`/api/inbox/${entryId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete entry');
      }

      setEntries(entries.filter(entry => entry.id !== entryId));
      router.refresh();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry. Please try again.');
    }
  };

  const handleUpdateAction = async (actionId: string, data: { completed: boolean }) => {
    try {
      const response = await fetch(`/api/actions/${actionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update action');
      }

      const updatedAction = await response.json();

      // Update the entries state with the updated action
      setEntries(entries.map(entry => {
        if (entry.actions.some(action => action.id === actionId)) {
          return {
            ...entry,
            actions: entry.actions.map(action =>
              action.id === actionId ? { ...action, ...updatedAction } : action
            )
          };
        }
        return entry;
      }));
    } catch (error) {
      console.error('Error updating action:', error);
      alert('Failed to update action. Please try again.');
    }
  };

  const handleExecuteAction = async (actionId: string) => {
    try {
      // Find the action in the entries state
      let actionDescription = '';
      let entryIndex = -1;
      let actionIndex = -1;

      // Find the entry and action indices
      entries.forEach((entry, eIndex) => {
        entry.actions.forEach((action, aIndex) => {
          if (action.id === actionId) {
            actionDescription = action.description;
            entryIndex = eIndex;
            actionIndex = aIndex;
          }
        });
      });

      if (entryIndex === -1 || actionIndex === -1) {
        throw new Error('Action not found');
      }

      // Immediately update the UI to show running status
      const updatedEntries = [...entries];
      updatedEntries[entryIndex].actions[actionIndex].metadata!.agentStatus = 'running';
      setEntries(updatedEntries);

      // Add to polling list
      setPollingActions(prev => [...prev, actionId]);

      // Create a prompt for the agent based on the action description and email content
      const entry = entries[entryIndex];
      if (!entry) {
        throw new Error('Entry not found');
      }

      // Include the custom agent prompt if available
      const customInstructions = customAgentPrompt
        ? `\n\nAdditional Instructions: ${customAgentPrompt}`
        : '';

      const prompt = `Please help me with the following task related to an email:
      
Task: ${actionDescription}

Email Subject: ${entry.title}
Email Content: ${entry.content}${customInstructions}

Please complete this task and provide a detailed summary of what you did.`;

      // Call the agent API
      const response = await fetch(`/api/agent/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          actionId
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to execute action');
      }

      const updatedAction = await response.json();

      // Update the entries state with the executed action
      setEntries(entries.map(entry => {
        if (entry.actions.some(action => action.id === actionId)) {
          return {
            ...entry,
            actions: entry.actions.map(action =>
              action.id === actionId ? { ...action, ...updatedAction } : action
            )
          };
        }
        return entry;
      }));
    } catch (error) {
      console.error('Error executing action:', error);
      alert('Failed to execute action. Please try again.');

      // Remove from polling if there was an error
      setPollingActions(prev => prev.filter(id => id !== actionId));

      // Reset the action status in case of error
      setEntries(entries.map(entry => {
        if (entry.actions.some(action => action.id === actionId)) {
          return {
            ...entry,
            actions: entry.actions.map(action => {
              if (action.id === actionId) {
                const updatedAction = { ...action };
                if (updatedAction.metadata) {
                  updatedAction.metadata.agentStatus = 'error';
                  updatedAction.metadata.agentError = 'Failed to execute action';
                } else {
                  updatedAction.metadata = {
                    agentStatus: 'error',
                    agentError: 'Failed to execute action'
                  };
                }
                return updatedAction;
              }
              return action;
            })
          };
        }
        return entry;
      }));
    }
  };

  // Parse agent results from JSON structure
  const parseAgentResults = (resultString: string): AgentHistoryList | null => {
    try {
      // Parse the JSON string
      const jsonData = JSON.parse(resultString);
      return jsonData as AgentHistoryList;
    } catch (error) {
      console.error('Error parsing agent results:', error);
      return null;
    }
  };

  // Render agent results in a structured way
  const renderAgentResults = (action: Action) => {
    if (!action.metadata?.agentResult) {
      return null;
    }

    try {
      // Parse the agentResult string to a JSON object
      const agentResult = typeof action.metadata.agentResult === 'string'
        ? parseAgentResults(action.metadata.agentResult)
        : action.metadata.agentResult as unknown as AgentHistoryList;

      if (!agentResult || !agentResult.all_results) {
        return (
          <div className="mt-2 text-sm">
            <h4 className="font-semibold text-gray-900">Agent Results:</h4>
            <pre className="whitespace-pre-wrap text-xs mt-1 bg-gray-100 p-2 rounded text-gray-900">
              {typeof action.metadata.agentResult === 'string'
                ? action.metadata.agentResult
                : JSON.stringify(action.metadata.agentResult, null, 2)}
            </pre>
          </div>
        );
      }

      // Check if there's a recording file in the agent result
      const recordingFile = agentResult.recordingFile ||
        (action.metadata as any)?.recordingFile;

      return (
        <div className="mt-2 text-sm">
          {/* Display recording if available */}
          {recordingFile && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">Agent Recording:</h4>
              <div className="relative aspect-video bg-gray-100 rounded overflow-hidden">
                <video
                  controls
                  className="w-full h-full"
                  src={recordingFile}
                  poster="/window.svg"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          )}

          <h4 className="font-semibold text-gray-900">Agent Actions:</h4>
          <div className="space-y-2 mt-1">
            {agentResult.all_results.map((result: AgentActionResult, index: number) => (
              <div
                key={index}
                className={`p-2 rounded ${result.error
                  ? 'bg-red-50 border border-red-200'
                  : result.is_done && result.success
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-gray-50 border border-gray-200'
                  }`}
              >
                {result.extracted_content && (
                  <div className="font-medium text-gray-900">{result.extracted_content}</div>
                )}
                {result.error && (
                  <div className="font-medium text-red-700 text-sm mt-1">{result.error}</div>
                )}
              </div>
            ))}
          </div>

          {agentResult.all_model_outputs && agentResult.all_model_outputs.length > 0 && (
            <>
              <h4 className="font-semibold text-gray-900 mt-4">Model Outputs:</h4>
              <div className="space-y-2 mt-1">
                {agentResult.all_model_outputs.map((output: any, index: number) => (
                  <div key={index} className="p-2 rounded bg-blue-50 border border-blue-200">
                    {output.go_to_url && (
                      <div className="font-medium text-gray-900">
                        Go to URL: {output.go_to_url.url}
                      </div>
                    )}
                    {output.extract_content && (
                      <div className="font-medium text-gray-900">
                        Extract content: {output.extract_content.goal}
                      </div>
                    )}
                    {output.done && (
                      <div className="font-medium text-gray-900">
                        Done: {output.done.text}
                        <div className="text-sm mt-1">
                          Success: {output.done.success ? 'Yes' : 'No'}
                        </div>
                      </div>
                    )}
                    {output.interacted_element && (
                      <div className="font-medium text-gray-900">
                        Interacted with element: {JSON.stringify(output.interacted_element)}
                      </div>
                    )}
                    {!output.go_to_url && !output.extract_content && !output.done && !output.interacted_element && (
                      <div className="font-medium text-gray-900">
                        {JSON.stringify(output, null, 2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      );
    } catch (error) {
      console.error('Error rendering agent results:', error);
      return (
        <div className="mt-2 text-sm text-red-600">
          Error displaying agent results
        </div>
      );
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          {entries.length} {entries.length === 1 ? 'Entry' : 'Entries'}
        </h2>
        <p className="text-sm text-gray-500">
          Entries are automatically created by processing your Gmail
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <h3 className="text-xl font-medium text-gray-700 mb-2">Loading...</h3>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <h3 className="text-xl font-medium text-gray-700 mb-2">Your inbox is empty</h3>
          <p className="text-gray-500 mb-4">
            Connect your Gmail account in Settings to start receiving entries
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onDelete={handleDeleteEntry}
              onUpdateAction={handleUpdateAction}
              onExecuteAction={handleExecuteAction}
              renderAgentResults={renderAgentResults}
            />
          ))}
        </div>
      )}
    </div>
  );
}
