import React from 'react';
import {
  Box,
  Text,
} from '@chakra-ui/react';
import { MessageItem, Message } from './MessageItem';

interface MessageListProps {
  messages: Message[];
  username: string;
  isLoadingHistory: boolean;
  renderKey: number;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  username,
  isLoadingHistory,
  renderKey,
}) => {
  return (
    <Box flex="1" overflowY="auto" p={4} bg="gray.100" key={renderKey}>
      {isLoadingHistory && (
        <Box textAlign="center" py={4}>
          <Text color="gray.500" fontSize="sm">Loading message history...</Text>
        </Box>
      )}
      
      {messages.length === 0 && !isLoadingHistory ? (
        <Box textAlign="center" py={8}>
          <Text color="gray.500" fontSize="sm">
            No messages yet. Start the conversation!
          </Text>
        </Box>
      ) : (
        messages.map((msg, index) => {
          const isOwnMessage = msg.user === username;
          
          return (
            <MessageItem
              key={index}
              message={msg}
              isOwnMessage={isOwnMessage}
              index={index}
            />
          );
        })
      )}
    </Box>
  );
}; 