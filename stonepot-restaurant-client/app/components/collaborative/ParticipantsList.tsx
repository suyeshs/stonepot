'use client';

import { observer } from 'mobx-react-lite';
import { collaborativeOrderStore } from '../../stores/collaborativeOrderStore';
import { Crown, UserPlus } from 'lucide-react';

interface ParticipantsListProps {
  compact?: boolean; // Horizontal scroll for mobile
}

export const ParticipantsList = observer(function ParticipantsList({ compact = false }: ParticipantsListProps) {
  const { participants, currentUserId } = collaborativeOrderStore;

  if (compact) {
    // Mobile: Horizontal scroll
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Participants ({participants.length})
        </h3>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {participants.map((participant) => {
            const isCurrentUser = participant.id === currentUserId;
            const initial = participant.name.charAt(0).toUpperCase();

            return (
              <div key={participant.id} className="flex flex-col items-center min-w-[60px]">
                <div className="relative">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold
                    ${isCurrentUser
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 ring-2 ring-blue-300'
                      : 'bg-gradient-to-br from-gray-400 to-gray-500'
                    }
                  `}>
                    {initial}
                  </div>
                  {participant.role === 'owner' && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center">
                      <Crown className="w-3 h-3 text-yellow-900" />
                    </div>
                  )}
                  {participant.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="text-xs text-gray-600 mt-1 text-center max-w-[60px] truncate">
                  {isCurrentUser ? 'You' : participant.name}
                </div>
              </div>
            );
          })}

          {/* Add Participant Button */}
          <div className="flex flex-col items-center min-w-[60px]">
            <button className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
              <UserPlus className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-xs text-gray-500 mt-1">
              Invite
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Desktop: Vertical list
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Participants
      </h3>
      <div className="space-y-3">
        {participants.map((participant) => {
          const isCurrentUser = participant.id === currentUserId;
          const initial = participant.name.charAt(0).toUpperCase();

          return (
            <div
              key={participant.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              style={{
                animation: 'fadeInUp 0.3s ease-out'
              }}
            >
              <div className="relative">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm
                  ${isCurrentUser
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 ring-2 ring-blue-300'
                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                  }
                `}>
                  {initial}
                </div>
                {participant.role === 'owner' && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                    <Crown className="w-2.5 h-2.5 text-yellow-900" />
                  </div>
                )}
                {participant.isOnline && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {isCurrentUser ? 'You' : participant.name}
                  {isCurrentUser && participant.role === 'owner' && (
                    <span className="ml-1 text-xs text-gray-500">(Owner)</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {participant.isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Participant Button */}
        <button className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-colors text-gray-600 hover:text-gray-700">
          <UserPlus className="w-4 h-4" />
          <span className="text-sm font-medium">Invite</span>
        </button>
      </div>
    </div>
  );
});
