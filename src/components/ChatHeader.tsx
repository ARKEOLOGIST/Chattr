import React from 'react';
import {
  Box,
  Button,
  Heading,
  Text,
  Flex,
  HStack
} from '@chakra-ui/react';

interface ChatHeaderProps {
  roomId: string;
  username: string;
  onCopyRoomId: () => void;
  onLeaveRoom: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  roomId,
  username,
  onCopyRoomId,
  onLeaveRoom
}) => {
  return (
    <Box bg="teal.500" color="white" p={4} w="100%">
      <Flex align="center">
        <Box flex="1">
          <HStack mb={1}>
            <Heading size="md">Room: {roomId}</Heading>
            <Button 
              size="xs" 
              variant="outline" 
              color="white"
              borderColor="white"
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={onCopyRoomId}
            >
              Copy
            </Button>
          </HStack>
          <Text fontSize="sm" opacity={0.8}>Welcome, {username}!</Text>
        </Box>
        <HStack>
          <Button 
            size="sm" 
            variant="ghost" 
            color="white"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={onLeaveRoom}
          >
            Leave Room
          </Button>
        </HStack>
      </Flex>
    </Box>
  );
}; 