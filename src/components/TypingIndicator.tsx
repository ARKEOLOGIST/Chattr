import React from 'react';
import {
  Box,
  Text,
} from '@chakra-ui/react';

interface TypingIndicatorProps {
  typingUsers: string[];
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  typingUsers,
}) => {
  if (typingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0]} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
    } else {
      return `Several users are typing...`;
    }
  };

  return (
    <Box position="absolute" left={4} bottom={20} zIndex={10}>
      <Text fontSize="xs" color="gray.500" bg="white" px={2} py={1} borderRadius="md" boxShadow="sm">
        {getTypingText()}
      </Text>
    </Box>
  );
}; 