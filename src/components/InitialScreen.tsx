import React from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  VStack,
  Text,
} from '@chakra-ui/react';

interface InitialScreenProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

export const InitialScreen: React.FC<InitialScreenProps> = ({
  onCreateRoom,
  onJoinRoom,
}) => {
  return (
    <Container centerContent py={24}>
      <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg" w="100%" maxW="md">
        <VStack>
          <Heading size="lg">Teleparty Chat</Heading>
          <Button colorScheme="teal" w="100%" onClick={onCreateRoom}>
            Create Room
          </Button>
          <Text>or</Text>
          <Button colorScheme="blue" w="100%" onClick={onJoinRoom}>
            Join Room
          </Button>
        </VStack>
      </Box>
    </Container>
  );
}; 