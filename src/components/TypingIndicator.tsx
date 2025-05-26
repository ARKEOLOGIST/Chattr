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
      return `User ${typingUsers[0]} is typing`;
    } else if (typingUsers.length === 2) {
      return `Users ${typingUsers[0]} and ${typingUsers[1]} are typing`;
    } else if (typingUsers.length === 3) {
      return `Users ${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers[2]} are typing`;
    } else {
      return `Users ${typingUsers.slice(0, 2).join(', ')} and ${typingUsers.length - 2} others are typing`;
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