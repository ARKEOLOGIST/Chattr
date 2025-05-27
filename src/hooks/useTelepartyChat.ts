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

export const useTelepartyChat = (onUserIdUpdate?: (newUserId: string) => Promise<void>) => {
  const [ws, setWs] = useState<TelepartyClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string>('');
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string>('');
  
  // Track session participants (userId -> username mapping)
  const [sessionParticipants, setSessionParticipants] = useState<Map<string, string>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  // Refs for cleanup and stable values
  const unsubscribeFirebase = useRef<(() => void) | null>(null);
  const messageTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const messageHandlerRef = useRef<((message: any) => void) | null>(null);
  const currentRoomIdRef = useRef<string>('');
  const currentUsernameRef = useRef<string>('');
  const currentUserIdRef = useRef<string>('');
  const sessionParticipantsRef = useRef<Map<string, string>>(new Map());

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

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    sessionParticipantsRef.current = sessionParticipants;
  }, [sessionParticipants]);

  // Create stable message handler that uses refs for current values
  useEffect(() => {
    const handleIncomingMessage = async (message: any) => {
      try {
        // Handle userId events
        if (message.type === 'userId' || message.data?.userId) {
          const newUserId = message.data?.userId || message.userId;
          if (newUserId && typeof newUserId === 'string') {
            setCurrentUserId(newUserId);
            
            // Add current user to session participants if we have a username
            if (currentUsernameRef.current) {
              setSessionParticipants(prev => {
                const updated = new Map(prev);
                updated.set(newUserId, currentUsernameRef.current);
                return updated;
              });
            }
            
            // Trigger userId update callback if provided
            if (onUserIdUpdate) {
              try {
                await onUserIdUpdate(newUserId);
              } catch (error) {
                console.error('Failed to handle userId event:', error);
              }
            }
          }
        }
        // Handle any message that has text content (user messages and system messages)
        else if (message.data?.body || message.data?.text || message.data?.message) {
          const chatMessage: Message = {
            user: message.data?.userNickname || message.data?.user || 'Anonymous',
            text: message.data?.body || message.data?.text || message.data?.message || '',
            timestamp: message.data?.timestamp || Date.now(),
            isSystemMessage: message.data?.isSystemMessage || false,
            type: message.type
          };
          
          // Track user in session participants if we have userId
          if (message.data?.userId && chatMessage.user) {
            setSessionParticipants(prev => {
              const updated = new Map(prev);
              updated.set(message.data.userId, chatMessage.user);
              return updated;
            });
          }
          
          // Check if this is a user join/leave system message
          if (chatMessage.isSystemMessage && chatMessage.text) {
            const userId = message.data?.userId;
            const username = chatMessage.user;
            
            // Handle user join messages (e.g., "Alice joined the party")
            if (chatMessage.text.includes('joined') && userId && username) {
              setSessionParticipants(prev => {
                const updated = new Map(prev);
                updated.set(userId, username);
                return updated;
              });
            }
            // Handle user leave messages (e.g., "Alice left the party")
            else if (chatMessage.text.includes('left') && userId) {
              setSessionParticipants(prev => {
                const updated = new Map(prev);
                updated.delete(userId);
                return updated;
              });
              
              // Also remove from typing users if they were typing
              setTypingUsers(prev => {
                const username = sessionParticipantsRef.current.get(userId);
                return username ? prev.filter(u => u !== username) : prev;
              });
            }
          }
          
          if (chatMessage.text && currentRoomIdRef.current) {
            await saveMessage(chatMessage, currentRoomIdRef.current);
          }
        }
        // Handle userList events to update session participants
        else if (message.type === 'userList') {
          const userListData = message.data;
          
          if (Array.isArray(userListData)) {
            // Build new session participants map from userList
            const newSessionParticipants = new Map<string, string>();
            
            for (const user of userListData) {
              const userId = user.socketConnectionId;
              const username = user.userSettings?.userNickname;
              
              if (userId && username) {
                newSessionParticipants.set(userId, username);
              }
            }
            
            setSessionParticipants(newSessionParticipants);
            
            // Clean up typing users for users who are no longer in the session
            setTypingUsers(prev => {
              return prev.filter(typingUsername => {
                // Keep typing user if they're still in the session
                return Array.from(newSessionParticipants.values()).includes(typingUsername);
              });
            });
          }
        }
        else if (message.type === 'setTypingPresence') {
          const { anyoneTyping, usersTyping } = message.data || {};
          
          if (anyoneTyping && Array.isArray(usersTyping)) {
            // Map userIds to usernames using session participants
            const typingUsernames: string[] = [];
            
            for (const userId of usersTyping) {
              // Skip current user
              if (userId === currentUserIdRef.current) {
                continue;
              }
              
              const username = sessionParticipantsRef.current.get(userId);
              if (username) {
                typingUsernames.push(username);
              } else {
                // If we don't have the username, use a fallback
                typingUsernames.push(`User ${userId.slice(-4)}`); // Show last 4 chars of userId
              }
            }
            
            setTypingUsers(typingUsernames);
            
            // Clear typing status after timeout (fallback safety)
            if (typingUsernames.length > 0) {
              // Clear any existing timeouts
              messageTimeouts.current.forEach(timeout => clearTimeout(timeout));
              messageTimeouts.current.clear();
              
              const timeout = setTimeout(() => {
                setTypingUsers([]);
              }, 5000); // 5 second timeout
              
              messageTimeouts.current.set('typing_timeout', timeout);
            }
          } else {
            // No one is typing
            setTypingUsers([]);
            
            // Clear any existing timeouts
            messageTimeouts.current.forEach(timeout => clearTimeout(timeout));
            messageTimeouts.current.clear();
          }
        }
      } catch (error) {
        console.error('Error handling incoming message:', error);
      }
    };

    messageHandlerRef.current = handleIncomingMessage;
  }, [saveMessage, onUserIdUpdate]);

  // Create WebSocket client with improved error handling
  const createClient = useCallback(() => {
    try {
      setConnectionError('');
      
      const eventHandler = {
        onMessage: (message: any) => {
          if (messageHandlerRef.current) {
            messageHandlerRef.current(message);
          }
        },
        onConnectionReady: async () => {
          setIsConnected(true);
          setConnectionError('');
          reconnectAttempts.current = 0;
        },
        onClose: () => {
          setIsConnected(false);
          
          // Attempt reconnection if not manually closed
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.pow(2, reconnectAttempts.current) * 1000; // Exponential backoff
            
            reconnectTimeout.current = setTimeout(() => {
              reconnectAttempts.current++;
              try {
                const newClient = createClient();
                setWs(newClient);
              } catch (error) {
                console.error('Reconnection failed:', error);
                setConnectionError('Failed to reconnect. Please try again.');
              }
            }, delay);
          } else {
            setConnectionError('Connection lost. Please refresh the page.');
          }
        }
      };
      
      const client = new TelepartyClient(eventHandler);
      return client;
    } catch (error) {
      console.error('Error creating TelepartyClient:', error);
      setConnectionError('Failed to create connection. Please check your internet connection.');
      throw error;
    }
  }, []);

  // Load message history from Firebase with better error handling
  const loadMessageHistory = useCallback(async (roomId: string) => {
    if (!roomId) return;
    
    setIsLoadingHistory(true);
    try {
      // Try Firebase first
      const { messages: firebaseMessages } = await firebaseMessageService.loadRoomMessages(roomId);
      
      if (firebaseMessages.length > 0) {
        const formattedMessages: Message[] = firebaseMessages.map(msg => ({
          user: msg.user,
          text: msg.text,
          timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : msg.timestamp.toMillis(),
          isSystemMessage: msg.isSystemMessage,
          type: msg.type
        }));
        setMessages(formattedMessages);
      } else {
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
    if (!ws || !isConnected || !text.trim()) return;

    try {
      const messageData = {
        body: text.trim()
      };
      
      ws.sendMessage(SocketMessageTypes.SEND_MESSAGE, messageData);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  }, [ws, isConnected]);

  // Send typing status
  const sendTypingStatus = useCallback((isTyping: boolean) => {
    if (!ws || !isConnected) {
      return;
    }

    if (!currentUsername) {
      return;
    }

    try {
      const typingData = {
        typing: isTyping,
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
      const roomId = await ws.createChatRoom(username);
      
      setCurrentRoomId(roomId);
      setCurrentUsername(username);

      // Add current user to session participants if we have userId
      if (currentUserId) {
        setSessionParticipants(prev => {
          const updated = new Map(prev);
          updated.set(currentUserId, username);
          return updated;
        });
      }

      // Create room in Firebase
      try {
        await firebaseMessageService.createOrUpdateRoom({
          roomId,
          roomName: `Room ${roomId}`,
          createdBy: username
        });
      } catch (firebaseError) {
        console.error('Failed to create room in Firebase:', firebaseError);
        // Continue anyway, room creation succeeded
      }

      // Add system message for room creation
      try {
        const systemMessage = {
          roomId,
          user: username,
          text: "created the party 🎉",
          timestamp: Date.now(),
          isSystemMessage: true
        };
        
        await firebaseMessageService.saveMessage(systemMessage);
      } catch (systemMessageError) {
        console.error('Failed to add room creation system message:', systemMessageError);
        // Continue anyway, this is not critical
      }

      // Load message history and subscribe to updates
      await loadMessageHistory(roomId);
      subscribeToFirebaseMessages(roomId);

      return roomId;
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }, [ws, loadMessageHistory, subscribeToFirebaseMessages, currentUserId]);

  // Join room with better error handling
  const joinRoom = useCallback(async (username: string, roomId: string): Promise<void> => {
    if (!ws) throw new Error('WebSocket not connected');

    try {
      await ws.joinChatRoom(username, roomId);
      
      setCurrentRoomId(roomId);
      setCurrentUsername(username);

      // Add current user to session participants if we have userId
      if (currentUserId) {
        setSessionParticipants(prev => {
          const updated = new Map(prev);
          updated.set(currentUserId, username);
          return updated;
        });
      }

      // Update room in Firebase
      try {
        await firebaseMessageService.createOrUpdateRoom({
          roomId,
          createdBy: username
        });
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
  }, [ws, loadMessageHistory, subscribeToFirebaseMessages, currentUserId]);

  // Cleanup function
  const cleanup = useCallback(() => {
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
    setCurrentUserId('');
    setSessionParticipants(new Map());
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