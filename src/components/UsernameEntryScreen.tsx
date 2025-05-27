import React from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  VStack
} from '@chakra-ui/react';

interface UsernameEntryScreenProps {
  username: string;
  onUsernameChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export const UsernameEntryScreen: React.FC<UsernameEntryScreenProps> = ({
  username,
  onUsernameChange,
  onSubmit,
  onBack,
}) => {
  const handleSubmit = () => {
    onSubmit();
  };

  return (
    <Container centerContent py={24}>
      <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg" w="100%" maxW="md">
        <VStack>
          <Heading size="lg">Choose Your Username</Heading>

          <Input
            placeholder="Enter your username (3-20 characters)"
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onUsernameChange(e.target.value)}
          />

          <Button colorScheme="green" w="100%" onClick={handleSubmit}>
            Enter Chat
          </Button>
          <Button variant="ghost" w="100%" onClick={onBack}>
            Back
          </Button>
        </VStack>
      </Box>
    </Container>
  );
}; 