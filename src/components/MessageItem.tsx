import React from 'react';
import {
  Box,
  Text,
} from '@chakra-ui/react';

export interface Message {
  user: string;
  text: string;
  timestamp: number;
  isSystemMessage?: boolean;
  type?: string;
}

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
  index: number;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isOwnMessage,
  index,
}) => {
  const { user, text, timestamp, isSystemMessage } = message;

  // System messages get special central styling
  if (isSystemMessage) {

    return (
      <Box key={index} mb={2} textAlign="center">
        <Box
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          bg="gray.100"
          color="gray.600"
          px={3}
          py={2}
          borderRadius="full"
          fontSize="sm"
          fontWeight="medium"
        >
          <Text>{user} {text}</Text>
        </Box>
        <Text fontSize="xs" color="gray.500" mt={1}>
          {new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </Box>
    );
  }
  
  // Regular messages: own messages on right, others on left
  return (
    <Box
      key={index}
      mb={3}
      display="flex"
      justifyContent={isOwnMessage ? "flex-end" : "flex-start"}
    >
      <Box
        bg={isOwnMessage ? "teal.500" : "white"}
        color={isOwnMessage ? "white" : "black"}
        p={3}
        borderRadius="lg"
        boxShadow="sm"
        maxW="70%"
        border={isOwnMessage ? "none" : "1px solid"}
        borderColor={isOwnMessage ? "transparent" : "gray.200"}
      >
        {!isOwnMessage && (
          <Text fontSize="xs" fontWeight="bold" color="teal.600" mb={1}>
            {user}
          </Text>
        )}
        <Text fontSize="sm">
          {text}
        </Text>
        <Text 
          fontSize="xs" 
          opacity={0.7} 
          mt={1}
          textAlign="right"
        >
          {new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </Box>
    </Box>
  );
}; 