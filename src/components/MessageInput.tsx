import React from 'react';
import {
  Box,
  Button,
  Input,
  Flex,
} from '@chakra-ui/react';

interface MessageInputProps {
  currentMessage: string;
  onMessageChange: (value: string) => void;
  onSendMessage: () => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  currentMessage,
  onMessageChange,
  onSendMessage,
  onInputFocus,
  onInputBlur,
}) => {
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSendMessage();
    }
  };

  return (
    <Box bg="white" p={4} borderTop="1px" borderColor="gray.200">
      <Flex gap={3}>
        <Input
          flex="1"
          placeholder="Type a message..."
          value={currentMessage}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onMessageChange(e.target.value)}
          onKeyPress={handleKeyPress}
          bg="gray.50"
          border="1px"
          borderColor="gray.300"
          borderRadius="full"
          px={4}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
        />
        <Button
          colorScheme="teal"
          borderRadius="full"
          px={6}
          onClick={onSendMessage}
          disabled={!currentMessage.trim()}
        >
          Send
        </Button>
      </Flex>
    </Box>
  );
}; 