import React from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  VStack,
} from '@chakra-ui/react';

interface RoomIdEntryScreenProps {
  tempRoomId: string;
  onTempRoomIdChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export const RoomIdEntryScreen: React.FC<RoomIdEntryScreenProps> = ({
  tempRoomId,
  onTempRoomIdChange,
  onSubmit,
  onBack,
}) => {
  return (
    <Container centerContent py={24}>
      <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg" w="100%" maxW="md">
        <VStack>
          <Heading size="lg">Enter Room ID</Heading>
          <Input
            placeholder="Room ID"
            value={tempRoomId}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTempRoomIdChange(e.target.value)}
          />
          <Button colorScheme="blue" w="100%" onClick={onSubmit}>
            Connect to Room
          </Button>
          <Button variant="ghost" w="100%" onClick={onBack}>
            Back
          </Button>
        </VStack>
      </Box>
    </Container>
  );
}; 