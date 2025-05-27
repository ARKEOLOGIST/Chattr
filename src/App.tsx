"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toaster, Toaster } from './components/ui/toaster';
import {
  InitialScreen,
  ConnectingScreen,
  RoomIdEntryScreen,
  UsernameEntryScreen,
  ChatScreen,
} from './components';
import { useTelepartyChat, useUsernameValidation, useClipboard, useUserProfile } from './hooks';

type AppState = 'initial' | 'connecting' | 'entering-username' | 'entering-room-id' | 'chat';

function App() {
  const [appState, setAppState] = useState<AppState>('initial');
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [tempRoomId, setTempRoomId] = useState('');
  const [flowType, setFlowType] = useState<'create' | 'join'>('create');
  const [currentMessage, setCurrentMessage] = useState('');
  const [renderKey, setRenderKey] = useState(0);

  const { validateUsername } = useUsernameValidation();
  const { copyToClipboard } = useClipboard();
  
  const {
    userProfile,
    createUserProfile,
    updateUserId,
    storeReceivedUserId,
    deleteUserProfile
  } = useUserProfile();

  // Create stable wrapper function for userId update using useRef
  const storeReceivedUserIdRef = useRef(storeReceivedUserId);
  const updateUserIdRef = useRef(updateUserId);
  storeReceivedUserIdRef.current = storeReceivedUserId;
  updateUserIdRef.current = updateUserId;

  const handleUserIdUpdate = useCallback(async (newUserId: string): Promise<void> => {
    try {
      // If user profile exists, update it directly
      if (userProfile) {
        await updateUserIdRef.current(newUserId);
        console.log('User ID updated successfully to:', newUserId);
      } else {
        // If no user profile yet, store the userId for later use during profile creation
        storeReceivedUserIdRef.current(newUserId);
        console.log('Stored received userId for later use:', newUserId);
      }
    } catch (error) {
      console.error('Failed to handle user ID update:', error);
      throw error;
    }
  }, [userProfile]); // Include userProfile to know when to update vs store

  // Custom hooks
  const {
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
  } = useTelepartyChat(handleUserIdUpdate);

  // Force re-render when transitioning to chat state
  useEffect(() => {
    if (appState === 'chat') {
      console.log("Transitioning to chat - forcing message list re-render");
      setRenderKey(prev => prev + 1);
    }
  }, [appState]);

  // Copy room ID to clipboard
  const copyRoomId = async () => {
    const success = await copyToClipboard(roomId);
    if (success) {
      toaster.create({ 
        title: 'Room ID copied to clipboard!', 
        type: 'success'
      });
    } else {
      toaster.create({ 
        title: 'Failed to copy room ID', 
        type: 'error'
      });
    }
  };

  // Handle Create Room flow
  const handleCreateRoom = () => {
    setFlowType('create');
    setAppState('connecting');
    
    try {
      const client = createClient();
      setWs(client);
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
      const client = createClient();
      setWs(client);
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
      // Create user profile first
      await createUserProfile({
        username
      });

      if (flowType === 'create') {
        const newRoomId = await createRoom(username);
        setRoomId(newRoomId);
        toaster.create({ title: `Room created! ID: ${newRoomId}`, type: 'success' });
      } else {
        await joinRoom(username, roomId);
        toaster.create({ title: `Joined room ${roomId}`, type: 'success' });
      }
      
      setAppState('chat');
    } catch (error) {
      console.error('Error:', error);
      toaster.create({ title: 'Failed to enter room', type: 'error' });
    }
  };

  // Handle back to initial screen (leaving room)
  const handleBackToInitial = async () => {
    cleanup();
    
    // Delete user profile when leaving
    if (userProfile) {
      try {
        await deleteUserProfile();
        toaster.create({ title: 'Profile deleted successfully', type: 'success' });
      } catch (error) {
        console.error('Failed to delete profile:', error);
        toaster.create({ title: 'Failed to delete profile', type: 'error' });
      }
    }
    
    setAppState('initial');
    setUsername('');
    setTempRoomId('');
    setRoomId('');
  };





  // Handle Send Message
  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;
    
    sendMessage(currentMessage);
    sendTypingStatus(false);
    setCurrentMessage('');
  };

  // Handle input focus (start typing)
  const handleInputFocus = useCallback(() => {
    sendTypingStatus(true);
  }, [sendTypingStatus]);

  // Handle input blur (stop typing)
  const handleInputBlur = useCallback(() => {
    sendTypingStatus(false);
  }, [sendTypingStatus]);

  // Auto-transition to username entry when connected
  useEffect(() => {
    if (isConnected && appState === 'connecting') {
      setAppState('entering-username');
    }
  }, [isConnected, appState]);

  // Render appropriate screen based on app state
  const renderScreen = () => {
    switch (appState) {
      case 'initial':
        return (
          <InitialScreen
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
          />
        );



      case 'connecting':
        return (
          <ConnectingScreen 
            onCancel={handleBackToInitial} 
            connectionError={connectionError}
            isConnected={isConnected}
          />
        );

      case 'entering-room-id':
        return (
          <RoomIdEntryScreen
            tempRoomId={tempRoomId}
            onTempRoomIdChange={setTempRoomId}
            onSubmit={handleRoomIdSubmit}
            onBack={handleBackToInitial}
          />
        );

      case 'entering-username':
        return (
          <UsernameEntryScreen
            username={username}
            onUsernameChange={setUsername}
            onSubmit={handleUsernameSubmit}
            onBack={handleBackToInitial}
          />
        );

      case 'chat':
        return (
          <ChatScreen
            roomId={roomId}
            username={username}
            messages={messages}
            isLoadingHistory={isLoadingHistory}
            renderKey={renderKey}
            typingUsers={typingUsers}
            currentMessage={currentMessage}
            onCopyRoomId={copyRoomId}
            onLeaveRoom={handleBackToInitial}
            onMessageChange={setCurrentMessage}
            onSendMessage={handleSendMessage}
            onInputFocus={handleInputFocus}
            onInputBlur={handleInputBlur}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <Toaster />
      {renderScreen()}
    </>
  );
}

export default App;
