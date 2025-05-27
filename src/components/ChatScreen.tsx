import React from 'react';
import {
  Box,
} from '@chakra-ui/react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { TypingIndicator } from './TypingIndicator';
import { MessageInput } from './MessageInput';
import { Message } from './MessageItem';

interface ChatScreenProps {
  roomId: string;
  username: string;
  messages: Message[];
  isLoadingHistory: boolean;
  renderKey: number;
  typingUsers: string[];
  currentMessage: string;
  onCopyRoomId: () => void;
  onLeaveRoom: () => void;
  onMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({
  roomId,
  username,
  messages,
  isLoadingHistory,
  renderKey,
  typingUsers,
  currentMessage,
  onCopyRoomId,
  onLeaveRoom,
  onMessageChange,
  onSendMessage,
  onInputFocus,
  onInputBlur,
}) => {
  return (
    <Box h="100vh" display="flex" flexDirection="column" bg="gray.50" position="relative">
      <ChatHeader
        roomId={roomId}
        username={username}
        onCopyRoomId={onCopyRoomId}
        onLeaveRoom={onLeaveRoom}
      />

      <MessageList
        messages={messages}
        username={username}
        isLoadingHistory={isLoadingHistory}
        renderKey={renderKey}
      />

      <TypingIndicator typingUsers={typingUsers} />

      <MessageInput
        currentMessage={currentMessage}
        onMessageChange={onMessageChange}
        onSendMessage={onSendMessage}
        onInputFocus={onInputFocus}
        onInputBlur={onInputBlur}
      />
    </Box>
  );
}; 