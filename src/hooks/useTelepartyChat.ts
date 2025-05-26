import { useState, useCallback, useRef, useEffect } from 'react';
import { TelepartyClient, SocketMessageTypes } from 'teleparty-websocket-lib';
import { firebaseMessageService } from '../services/firebaseService';
import { chatDB } from '../services/database';

export interface Message {
  user: string;
  text: string;
  timestamp: number;
  isSystemMessage?: boolean;
  type?: string;
}

export const useTelepartyChat = () => {
  const [ws, setWs] = useState<TelepartyClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string>('');
  
  // Refs for cleanup and stable values
  const unsubscribeFirebase = useRef<(() => void) | null>(null);
  const messageTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const messageHandlerRef = useRef<((message: any) => void) | null>(null);
  const currentRoomIdRef = useRef<string>('');
  const currentUsernameRef = useRef<string>('');

  // Save message to both Firebase and local storage
  const saveMessage = useCallback(async (message: Message, roomId: string) => {
    try {
      // Save to Firebase (primary)
      await firebaseMessageService.saveMessage({
        roomId,
        user: message.user,
        text: message.text,
        timestamp: message.timestamp,
        isSystemMessage: message.isSystemMessage
      });
    } catch (error) {
      console.error('Failed to save to Firebase, saving locally:', error);
      // Fallback to local storage
      try {
        await chatDB.saveMessage({
          roomId,
          user: message.user,
          text: message.text,
          timestamp: message.timestamp,
          isSystemMessage: message.isSystemMessage
        });
      } catch (localError) {
        console.error('Failed to save to local storage:', localError);
      }
    }
  }, []);

  // Keep refs in sync with state
  useEffect(() => {
    currentRoomIdRef.current = currentRoomId;
  }, [currentRoomId]);

  useEffect(() => {
    currentUsernameRef.current = currentUsername;
  }, [currentUsername]);

  // Create stable message handler that uses refs for current values
  useEffect(() => {
    const handleIncomingMessage = async (message: any) => {
      console.log('Received WebSocket message:', message);
      
      try {
        // Handle any message that has text content (user messages and system messages)
        if (message.data?.body || message.data?.text || message.data?.message) {
          const chatMessage: Message = {
            user: message.data?.userNickname || message.data?.user || 'Anonymous',
            text: message.data?.body || message.data?.text || message.data?.message || '',
            timestamp: message.data?.timestamp || Date.now(),
            isSystemMessage: message.data?.isSystemMessage || false,
            type: message.type
          };
          
          if (chatMessage.text && currentRoomIdRef.current) {
            await saveMessage(chatMessage, currentRoomIdRef.current);
          }
        } else if (message.type === 'typing' || message.type === 'setTypingPresence') {
          const { user, isTyping } = message.data || {};
          const username = user || message.data?.userNickname;
          
          if (username && username !== currentUsernameRef.current) {
            setTypingUsers(prev => {
              if (isTyping) {
                return prev.includes(username) ? prev : [...prev, username];
              } else {
                return prev.filter(u => u !== username);
              }
            });

            // Clear typing status after timeout
            if (isTyping) {
              const existingTimeout = messageTimeouts.current.get(username);
              if (existingTimeout) {
                clearTimeout(existingTimeout);
              }

              const timeout = setTimeout(() => {
                setTypingUsers(prev => prev.filter(u => u !== username));
                messageTimeouts.current.delete(username);
              }, 3000);

              messageTimeouts.current.set(username, timeout);
            }
          }
        }
      } catch (error) {
        console.error('Error handling incoming message:', error);
      }
    };

    messageHandlerRef.current = handleIncomingMessage;
  }, [saveMessage]); // Include saveMessage dependency

  // Create WebSocket client with improved error handling
  const createClient = useCallback(() => {
    try {
      console.log('Creating TelepartyClient...');
      console.log('TelepartyClient constructor available:', typeof TelepartyClient);
      setConnectionError('');
      
      const eventHandler = {
        onMessage: (message: any) => {
          console.log('📨 WebSocket message received:', message);
          if (messageHandlerRef.current) {
            messageHandlerRef.current(message);
          }
        },
        onConnectionReady: async () => {
          console.log('✅ WebSocket connected successfully');
          setIsConnected(true);
          setConnectionError('');
          reconnectAttempts.current = 0;
          
        },
        onClose: () => {
          console.log('❌ WebSocket disconnected');
          setIsConnected(false);
          
          // Attempt reconnection if not manually closed
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
            console.log(`🔄 Attempting reconnection in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);
            
            reconnectTimeout.current = setTimeout(() => {
              reconnectAttempts.current++;
              try {
                const newClient = createClient();
                setWs(newClient);
              } catch (error) {
                console.error('❌ Reconnection failed:', error);
                setConnectionError('Failed to reconnect. Please try again.');
              }
            }, delay);
          } else {
            console.error('❌ Max reconnection attempts reached');
            setConnectionError('Connection lost. Please refresh the page.');
          }
        }
      };
      
      console.log('🔌 Creating TelepartyClient with event handler...');
      const client = new TelepartyClient(eventHandler);
      console.log('✅ TelepartyClient created successfully:', client);
      
      // Log the client methods to understand the API
      console.log('📋 Available client methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client)));
      
      return client;
    } catch (error) {
      console.error('❌ Error creating TelepartyClient:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      setConnectionError('Failed to create connection. Please check your internet connection.');
      throw error;
    }
  }, []);

  // Load message history from Firebase with better error handling
  const loadMessageHistory = useCallback(async (roomId: string) => {
    if (!roomId) return;
    
    setIsLoadingHistory(true);
    try {
      console.log(`Loading message history for room: ${roomId}`);
      
      // Try Firebase first
      const { messages: firebaseMessages } = await firebaseMessageService.loadRoomMessages(roomId);
      
      if (firebaseMessages.length > 0) {
        console.log(`Loaded ${firebaseMessages.length} messages from Firebase`);
        const formattedMessages: Message[] = firebaseMessages.map(msg => ({
          user: msg.user,
          text: msg.text,
          timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : msg.timestamp.toMillis(),
          isSystemMessage: msg.isSystemMessage,
          type: msg.type
        }));
        setMessages(formattedMessages);
      } else {
        console.log('No Firebase messages found, checking local storage...');
        // Fallback to IndexedDB if no Firebase messages
        const localMessages = await chatDB.loadRoomMessages(roomId);
        const formattedMessages: Message[] = localMessages.map(msg => ({
          user: msg.user,
          text: msg.text,
          timestamp: msg.timestamp,
          isSystemMessage: msg.isSystemMessage
        }));
        setMessages(formattedMessages);
        
        // Migrate local messages to Firebase
        if (formattedMessages.length > 0) {
          console.log(`Migrating ${formattedMessages.length} local messages to Firebase...`);
          for (const msg of formattedMessages) {
            try {
              await firebaseMessageService.saveMessage({
                roomId,
                user: msg.user,
                text: msg.text,
                timestamp: msg.timestamp,
                isSystemMessage: msg.isSystemMessage
              });
            } catch (error) {
              console.error('Failed to migrate message:', error);
            }
          }
          console.log('Migration completed');
        }
      }
    } catch (error) {
      console.error('Error loading message history:', error);
      // Fallback to local storage
      try {
        const localMessages = await chatDB.loadRoomMessages(roomId);
        const formattedMessages: Message[] = localMessages.map(msg => ({
          user: msg.user,
          text: msg.text,
          timestamp: msg.timestamp,
          isSystemMessage: msg.isSystemMessage
        }));
        setMessages(formattedMessages);
        console.log(`Loaded ${formattedMessages.length} messages from local storage`);
      } catch (localError) {
        console.error('Failed to load from local storage:', localError);
        setMessages([]);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Subscribe to real-time Firebase updates
  const subscribeToFirebaseMessages = useCallback((roomId: string) => {
    if (unsubscribeFirebase.current) {
      unsubscribeFirebase.current();
    }

    try {
      console.log(`Subscribing to Firebase updates for room: ${roomId}`);
      unsubscribeFirebase.current = firebaseMessageService.subscribeToRoomMessages(
        roomId,
        (firebaseMessages) => {
          const formattedMessages: Message[] = firebaseMessages.map(msg => ({
            user: msg.user,
            text: msg.text,
            timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : msg.timestamp.toMillis(),
            isSystemMessage: msg.isSystemMessage,
            type: msg.type
          }));
          setMessages(formattedMessages);
        },
        (error) => {
          console.error('Firebase subscription error:', error);
        }
      );
    } catch (error) {
      console.error('Failed to subscribe to Firebase updates:', error);
    }
  }, []);

  // Send message with better error handling
  const sendMessage = useCallback((text: string) => {
    if (!ws || !isConnected || !text.trim()) {
      console.warn('Cannot send message: WebSocket not connected or empty text');
      return;
    }

    try {
      const messageData = {
        body: text.trim()
      };
      
      console.log('Sending message:', messageData);
      ws.sendMessage(SocketMessageTypes.SEND_MESSAGE, messageData);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [ws, isConnected]);

  // Send typing status
  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!ws || !isConnected) return;

    try {
      const typingData = {
        isTyping: isTyping,
        user: currentUsername,
        userNickname: currentUsername
      };
      ws.sendMessage(SocketMessageTypes.SET_TYPING_PRESENCE, typingData);
    } catch (error) {
      console.error('Error sending typing status:', error);
    }
  }, [ws, isConnected, currentUsername]);

  // Create room with better error handling
  const createRoom = useCallback(async (username: string): Promise<string> => {
    if (!ws) throw new Error('WebSocket not connected');

    try {
      console.log(`Creating room for user: ${username}`);
      const roomId = await ws.createChatRoom(username);
      console.log(`Room created with ID: ${roomId}`);
      
      setCurrentRoomId(roomId);
      setCurrentUsername(username);

      // Create room in Firebase
      try {
        await firebaseMessageService.createOrUpdateRoom({
          roomId,
          roomName: `Room ${roomId}`,
          createdBy: username
        });
        console.log('Room created in Firebase');
      } catch (firebaseError) {
        console.error('Failed to create room in Firebase:', firebaseError);
        // Continue anyway, room creation succeeded
      }

      // Load message history and subscribe to updates
      await loadMessageHistory(roomId);
      subscribeToFirebaseMessages(roomId);


      return roomId;
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }, [ws, loadMessageHistory, subscribeToFirebaseMessages]);

  // Join room with better error handling
  const joinRoom = useCallback(async (username: string, roomId: string): Promise<void> => {
    if (!ws) throw new Error('WebSocket not connected');

    try {
      console.log(`Joining room ${roomId} as user: ${username}`);
      await ws.joinChatRoom(username, roomId);
      console.log(`Successfully joined room: ${roomId}`);
      
      setCurrentRoomId(roomId);
      setCurrentUsername(username);

      // Update room in Firebase
      try {
        await firebaseMessageService.createOrUpdateRoom({
          roomId,
          createdBy: username
        });
        console.log('Room updated in Firebase');
      } catch (firebaseError) {
        console.error('Failed to update room in Firebase:', firebaseError);
        // Continue anyway, room join succeeded
      }

      // Load message history and subscribe to updates
      await loadMessageHistory(roomId);
      subscribeToFirebaseMessages(roomId);

    } catch (error) {
      console.error('Error joining room:', error);
      throw error;
    }
  }, [ws, loadMessageHistory, subscribeToFirebaseMessages]);

  // Cleanup function
  const cleanup = useCallback(() => {
    console.log('Cleaning up chat connection...');
    
    // Clear reconnection timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    
    // Clear typing timeouts
    messageTimeouts.current.forEach(timeout => clearTimeout(timeout));
    messageTimeouts.current.clear();

    // Unsubscribe from Firebase
    if (unsubscribeFirebase.current) {
      unsubscribeFirebase.current();
      unsubscribeFirebase.current = null;
    }

    // Close WebSocket
    if (ws) {
      try {
        ws.teardown();
      } catch (error) {
        console.error('Error disconnecting WebSocket:', error);
      }
    }

    // Reset state
    setWs(null);
    setIsConnected(false);
    setMessages([]);
    setTypingUsers([]);
    setCurrentRoomId('');
    setCurrentUsername('');
    setConnectionError('');
    reconnectAttempts.current = 0;
  }, [ws]);

  // Note: Removed automatic cleanup on unmount to prevent connection issues
  // Cleanup should be called manually when leaving the chat

  return {
    ws,
    setWs,
    isConnected,
    messages,
    typingUsers,
    isLoadingHistory,
    connectionError,
    createClient,
    sendMessage,
    sendTypingStatus,
    createRoom,
    joinRoom,
    cleanup
  };
}; 