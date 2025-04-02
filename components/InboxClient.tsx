'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import EntryCard from './EntryCard';
import { InboxEntry } from '@/types';

type InboxClientProps = {
  initialEntries: InboxEntry[];
};

export default function InboxClient({ initialEntries }: InboxClientProps) {
  const [entries, setEntries] = useState<InboxEntry[]>(initialEntries);
  const router = useRouter();

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
      const response = await fetch(`/api/actions/execute/${actionId}`, {
        method: 'POST',
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

      // Show success message
      alert('Action executed successfully!');
    } catch (error) {
      console.error('Error executing action:', error);
      alert('Failed to execute action. Please try again.');
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

      {entries.length === 0 ? (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
