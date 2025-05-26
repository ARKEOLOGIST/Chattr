import React from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  VStack,
  Text,
  Spinner,
  HStack,
} from '@chakra-ui/react';

interface ConnectingScreenProps {
  onCancel: () => void;
  connectionError?: string;
  isConnected?: boolean;
}

export const ConnectingScreen: React.FC<ConnectingScreenProps> = ({
  onCancel,
  connectionError,
  isConnected,
}) => {
  return (
    <Container centerContent py={24}>
      <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg" w="100%" maxW="md">
        <VStack gap={4}>
          <Heading size="lg">
            {isConnected ? 'Connected!' : 'Connecting...'}
          </Heading>
          
          {!connectionError && !isConnected && (
            <HStack>
              <Spinner size="sm" />
              <Text>Establishing connection to server...</Text>
            </HStack>
          )}
          
          {isConnected && (
            <Text color="green.500">
              Successfully connected to server!
            </Text>
          )}
          
          {connectionError && (
            <Box p={4} bg="red.50" borderRadius="md" borderWidth={1} borderColor="red.200">
              <Text color="red.600" fontWeight="bold" mb={2}>
                Connection Failed!
              </Text>
              <Text color="red.500" fontSize="sm">
                {connectionError}
              </Text>
            </Box>
          )}
          
          <Button variant="ghost" w="100%" onClick={onCancel}>
            {connectionError ? 'Back' : 'Cancel'}
          </Button>
        </VStack>
      </Box>
    </Container>
  );
}; 