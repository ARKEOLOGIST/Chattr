"usee client"

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Container,
  Heading,
  Input,
  VStack,
  Text,
  Dialog,
  useDisclosure,
  HStack,
  Flex,
  Spacer,
  IconButton,
} from '@chakra-ui/react';
import { toaster, Toaster } from './components/ui/toaster';
import { TelepartyClient, SocketEventHandler, SocketMessageTypes } from 'teleparty-websocket-lib';
import { chatDB, ChatMessage } from './services/database';

type AppState = 'initial' | 'connecting' | 'entering-username' | 'entering-room-id' | 'chat';

function App() {
  const [appState, setAppState] = useState<AppState>('initial');
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [tempRoomId, setTempRoomId] = useState('');
  const [messages, setMessages] = useState<{ user: string; text: string; timestamp: number; isSystemMessage?: boolean }[]>([]);
  const [ws, setWs] = useState<TelepartyClient | null>(null);
  const [flowType, setFlowType] = useState<'create' | 'join'>('create');
  const [isConnected, setIsConnected] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [renderKey, setRenderKey] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  // Modal controls
  const { open: isRoomIdModalOpen, onOpen: onRoomIdModalOpen, onClose: onRoomIdModalClose } = useDisclosure();
  const { open: isUsernameModalOpen, onOpen: onUsernameModalOpen, onClose: onUsernameModalClose } = useDisclosure();

  // Force re-render when transitioning to chat state to show any messages that arrived early
  useEffect(() => {
    if (appState === 'chat') {
      console.log("Transitioning to chat - forcing message list re-render");
      console.log("Messages at transition:", messages);
      setRenderKey(prev => prev + 1);
    }
  }, [appState]);

  // Copy room ID to clipboard
  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      toaster.create({ 
        title: 'Room ID copied to clipboard!', 
        type: 'success'
      });
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = roomId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      toaster.create({ 
        title: 'Room ID copied to clipboard!', 
        type: 'success'
      });
    }
  };

  // Load message history from database when entering a room
  const loadMessageHistory = useCallback(async (roomId: string) => {
    if (!roomId) return;
    
    setIsLoadingHistory(true);
    try {
      const savedMessages = await chatDB.loadRoomMessages(roomId);
      const formattedMessages = savedMessages.map(msg => ({
        user: msg.user,
        text: msg.text,
        timestamp: msg.timestamp,
        isSystemMessage: msg.isSystemMessage || false
      }));
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Failed to load message history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Save message to database
  const saveMessageToDB = useCallback(async (message: { user: string; text: string; timestamp: number; isSystemMessage?: boolean }, newRoomId?: string) => {
    const currentRoomId = newRoomId || roomId;
    if (!currentRoomId) return;
    
    try {
      await chatDB.saveMessage({
        roomId: currentRoomId,
        user: message.user,
        text: message.text,
        timestamp: message.timestamp,
        isSystemMessage: message.isSystemMessage
      });
    } catch (error) {
      console.error('Failed to save message to database:', error);
    }
  }, [roomId]);

  // Username validation
  const validateUsername = (name: string): { isValid: boolean; error?: string } => {
    if (!name.trim()) {
      return { isValid: false, error: 'Username cannot be empty' };
    }
    if (name.length < 3) {
      return { isValid: false, error: 'Username must be at least 3 characters' };
    }
    if (name.length > 20) {
      return { isValid: false, error: 'Username must be less than 20 characters' };
    }
    // Check for dangerous characters
    const dangerousChars = /[<>'"&\\]/;
    if (dangerousChars.test(name)) {
      return { isValid: false, error: 'Username contains invalid characters' };
    }
    return { isValid: true };
  };

  // Create event handler once
  const eventHandler: SocketEventHandler = {
    onConnectionReady: () => {
      setIsConnected(true);
      // Only show username entry after connection is ready
      setAppState('entering-username');
    },
    onClose: () => {
      setIsConnected(false);
    },
    onMessage: (message) => {
      console.log(message);
      if (message.data && !Array.isArray(message.data)) {
        // Extract message text - body is the correct field
        const messageText = message.data.body || '';
        
        // Extract username - userNickname is the correct field
        const messageUser = message.data.userNickname || 'Anonymous';
        
        // Check if this is a system message using the library's flag
        const isSystemMessage = message.data.isSystemMessage;

          if (message.type === SocketMessageTypes.SET_TYPING_PRESENCE) {
            const typingUsername = messageUser;
            const isTyping = message.data.typing;
            
            setTypingUsers(prev => {
              if (isTyping) {
                // Add user to typing list if not already there
                return prev.includes(typingUsername) ? prev : [...prev, typingUsername];
              } else {
                // Remove user from typing list
                return prev.filter(user => user !== typingUsername);
              }
            });
            return; // Don't process typing status as regular message
          }

        if (message.type === SocketMessageTypes.SEND_MESSAGE) {
          // Process the message
          const newMessage = {
            user: messageUser, 
            text: messageText, 
            timestamp: Date.now(),
            isSystemMessage: isSystemMessage
          };
        
          // Always add to local state (even if not in chat state yet)
          setMessages((prev) => [...prev, newMessage]);
          
          // Save to database
          saveMessageToDB(newMessage);
        }

      }
    }
  };

  // Helper function to create TelepartyClient
  const createTelepartyClient = useCallback(() => {
    return new TelepartyClient(eventHandler);
  }, []);

  const sendMessage = (text: string) => {
    if (ws && text.trim()) {
      ws.sendMessage(SocketMessageTypes.SEND_MESSAGE, {
        body: text
      });
    }
  };

  // Handle Create Room flow
  const handleCreateRoom = () => {
    setFlowType('create');
    setAppState('connecting');
    
    try {
      const client = createTelepartyClient();
      setWs(client);
      // Connection will trigger onConnectionReady, which will show username entry
    } catch (error) {
      console.error('Error creating client:', error);
      toaster.create({ title: 'Failed to establish connection', type: 'error' });
      setAppState('initial');
    }
  };

  // Handle Join Room flow
  const handleJoinRoom = () => {
    setFlowType('join');
    setAppState('entering-room-id');
  };

  // Handle Room ID submission (for join flow)
  const handleRoomIdSubmit = async () => {
    if (!tempRoomId.trim()) {
      toaster.create({ title: 'Enter a room ID', type: 'warning' });
      return;
    }
    
    setAppState('connecting');
    setRoomId(tempRoomId);
    
    try {
      const client = createTelepartyClient();
      setWs(client);
      // Connection will trigger onConnectionReady, which will show username entry
    } catch (error) {
      toaster.create({ title: 'Failed to connect to room', type: 'error' });
      setAppState('entering-room-id');
    }
  };

  // Handle Username submission
  const handleUsernameSubmit = async () => {
    const validation = validateUsername(username);
    if (!validation.isValid) {
      toaster.create({ title: validation.error!, type: 'warning' });
      return;
    }

    if (!ws || !isConnected) {
      toaster.create({ title: 'Not connected to server', type: 'error' });
      return;
    }

    try {
      if (flowType === 'create') {
        const newRoomId = await ws.createChatRoom(username, undefined);
        setRoomId(newRoomId);
        toaster.create({ title: `Room created! ID: ${newRoomId}`, type: 'success' });

        // Process the message
        const newMessage = {
          user: username, 
          text: "created the party🎉", 
          timestamp: Date.now(),
          isSystemMessage: true
        };
        
        // Always add to local state (even if not in chat state yet)
        setMessages((prev) => [...prev, newMessage]);
        
        // Save to database
        saveMessageToDB(newMessage,newRoomId);
        
        // Load any existing history for this room
        await loadMessageHistory(newRoomId);
      } else {
        // Join existing room
        await ws.joinChatRoom(username, roomId, undefined);
        toaster.create({ title: `Joined room ${roomId}`, type: 'success' });

        // Process the message
        const newMessage = {
          user: username, 
          text: "joined the party🎉", 
          timestamp: Date.now(),
          isSystemMessage: true
        };
        
        // Always add to local state (even if not in chat state yet)
        setMessages((prev) => [...prev, newMessage]);
        
        // Save to database
        saveMessageToDB(newMessage);
        
        // Load message history from database
        await loadMessageHistory(roomId);
      }
      
      setAppState('chat');
    } catch (error) {
      console.error('Error:', error);
      toaster.create({ title: 'Failed to enter room', type: 'error' });
    }
  };

  // Handle back to initial screen (leaving room)
  const handleBackToInitial = async () => {

    // Clean up state
    setAppState('initial');
    setUsername('');
    setTempRoomId('');
    setIsConnected(false);
    setMessages([]);
    if (ws) {
      // Close existing socket client
      ws.teardown();
      // Clean up connection
      setWs(null);
    }
  };

  // Handle Send Message
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || !ws) return;
    
    sendMessage(currentMessage);
    
    // Stop typing status when message is sent
    sendTypingStatus(false);
    
    // Clear input immediately for better UX, but don't add to state yet
    // Let the message come back from the server to ensure synchronization
    setCurrentMessage('');
  };

  // Send typing status
  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!ws || !username) return;
    
    ws.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, {
      typing: isTyping
    });
  }, [ws, username]);

  // Handle input focus (start typing)
  const handleInputFocus = useCallback(() => {
    sendTypingStatus(true);
  }, [sendTypingStatus]);

  // Handle input blur (stop typing)
  const handleInputBlur = useCallback(() => {
    sendTypingStatus(false);
  }, [sendTypingStatus]);

  // Initial Screen
  if (appState === 'initial') {
    return (
      <>
        <Toaster />
        <Container centerContent py={24}>
          <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg" w="100%" maxW="md">
            <VStack>
              <Heading size="lg">Teleparty Chat</Heading>
              <Button colorScheme="teal" w="100%" onClick={handleCreateRoom}>
                Create Room
              </Button>
              <Text>or</Text>
              <Button colorScheme="blue" w="100%" onClick={handleJoinRoom}>
                Join Room
              </Button>
            </VStack>
          </Box>
        </Container>
      </>
    );
  }

  // Connecting Screen
  if (appState === 'connecting') {
    return (
      <>
        <Toaster />
        <Container centerContent py={24}>
          <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg" w="100%" maxW="md">
            <VStack>
              <Heading size="lg">Connecting...</Heading>
              <Text>Establishing connection to server...</Text>
              <Button variant="ghost" w="100%" onClick={handleBackToInitial}>
                Cancel
              </Button>
            </VStack>
          </Box>
        </Container>
      </>
    );
  }

  // Room ID Entry Screen (for join flow)
  if (appState === 'entering-room-id') {
    return (
      <>
        <Toaster />
        <Container centerContent py={24}>
          <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg" w="100%" maxW="md">
            <VStack>
              <Heading size="lg">Enter Room ID</Heading>
              <Input
                placeholder="Room ID"
                value={tempRoomId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempRoomId(e.target.value)}
              />
              <Button colorScheme="blue" w="100%" onClick={handleRoomIdSubmit}>
                Connect to Room
              </Button>
              <Button variant="ghost" w="100%" onClick={handleBackToInitial}>
                Back
              </Button>
            </VStack>
          </Box>
        </Container>
      </>
    );
  }

  // Username Entry Screen
  if (appState === 'entering-username') {
    return (
      <>
        <Toaster />
        <Container centerContent py={24}>
          <Box p={8} borderWidth={1} borderRadius="lg" boxShadow="lg" w="100%" maxW="md">
            <VStack>
              <Heading size="lg">Choose Your Username</Heading>
              <Input
                placeholder="Enter your username (3-20 characters)"
                value={username}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              />
              <Button colorScheme="green" w="100%" onClick={handleUsernameSubmit}>
                Enter Chat
              </Button>
              <Button variant="ghost" w="100%" onClick={handleBackToInitial}>
                Back
              </Button>
            </VStack>
          </Box>
        </Container>
      </>
    );
  }

  // Chat Screen with enhanced user event display
  if (appState === 'chat') {
    return (
      <>
        <Toaster />
        <Box h="100vh" display="flex" flexDirection="column" bg="gray.50" position="relative">
          {/* Chat Header */}
          <Box bg="teal.500" color="white" p={4}>
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
                    onClick={copyRoomId}
                  >
                    Copy
                  </Button>
                </HStack>
                <Text fontSize="sm" opacity={0.8}>Welcome, {username}!</Text>
              </Box>
              <Button 
                size="sm" 
                variant="ghost" 
                color="white"
                _hover={{ bg: "whiteAlpha.200" }}
                onClick={handleBackToInitial}
              >
                Leave Room
              </Button>
            </Flex>
          </Box>

          {/* Messages Area */}
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
                const isSystemMessage = msg.isSystemMessage;
                
                // System messages (join/leave) get special central styling
                if (isSystemMessage) {
                  return (
                    <Box key={index} mb={2} textAlign="center">
                      <Box
                        display="inline-block"
                        bg="blue.100"
                        color="blue.800"
                        px={3}
                        py={1}
                        borderRadius="full"
                        fontSize="sm"
                        fontWeight="medium"
                      >
                        {msg.user && msg.user !== 'Anonymous' ? `${msg.user} ${msg.text}` : msg.text}
                      </Box>
                      <Text fontSize="xs" color="gray.500" mt={1}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { 
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
                          {msg.user}
                        </Text>
                      )}
                      <Text fontSize="sm">
                        {msg.text}
                      </Text>
                      <Text 
                        fontSize="xs" 
                        opacity={0.7} 
                        mt={1}
                        textAlign="right"
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </Text>
                    </Box>
                  </Box>
                );
              })
            )}
          </Box>

          {/* Typing Indicator */}
          {typingUsers.length > 0 && (
            <Box position="absolute" left={4} bottom={20} zIndex={10}>
              <Text fontSize="xs" color="gray.500" bg="white" px={2} py={1} borderRadius="md" boxShadow="sm">
                {typingUsers.length === 1 
                  ? `User ${typingUsers[0]} is typing`
                  : typingUsers.length === 2
                  ? `Users ${typingUsers[0]} and ${typingUsers[1]} are typing`
                  : typingUsers.length === 3
                  ? `Users ${typingUsers[0]}, ${typingUsers[1]} and ${typingUsers[2]} are typing`
                  : `Users ${typingUsers.slice(0, 2).join(', ')} and ${typingUsers.length - 2} others are typing`
                }
              </Text>
            </Box>
          )}

          {/* Message Input Area */}
          <Box bg="white" p={4} borderTop="1px" borderColor="gray.200">
            <Flex gap={3}>
              <Input
                flex="1"
                placeholder="Type a message..."
                value={currentMessage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSendMessage();
                  }
                }}
                bg="gray.50"
                border="1px"
                borderColor="gray.300"
                borderRadius="full"
                px={4}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
              <Button
                colorScheme="teal"
                borderRadius="full"
                px={6}
                onClick={handleSendMessage}
                disabled={!currentMessage.trim()}
              >
                Send
              </Button>
            </Flex>
          </Box>
        </Box>
      </>
    );
  }

  return null;
}

export default App;
