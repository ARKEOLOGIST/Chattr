import { useState } from 'react';
import { userService } from '../services/userService';
import { UserProfile, CreateUserProfileData, UpdateUserProfileData } from '../types/user';

export const useUserProfile = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate a unique user ID for the session
  const [userId, setUserId] = useState(() => userService.generateUserId());
  
  // Store received userId from server events
  const [receivedUserId, setReceivedUserId] = useState<string | null>(null);

  /**
   * Create a new user profile
   */
  const createUserProfile = async (data: Omit<CreateUserProfileData, 'userId'>): Promise<UserProfile> => {
    setIsLoading(true);
    setError(null);

    try {
      // Use received userId from server if available, otherwise use generated one
      const userIdToUse = receivedUserId || userId;
      
      const profile = await userService.createUserProfile({
        ...data,
        userId: userIdToUse
      });
      
      // Update local userId to match what was used
      if (receivedUserId && receivedUserId !== userId) {
        setUserId(receivedUserId);
      }
      
      setUserProfile(profile);
      return profile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create user profile';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update the current user profile
   */
  const updateUserProfile = async (data: UpdateUserProfileData): Promise<UserProfile> => {
    if (!userProfile) {
      throw new Error('No user profile to update');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedProfile = await userService.updateUserProfile(userId, data);
      setUserProfile(updatedProfile);
      return updatedProfile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update user profile';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete the current user profile
   */
  const deleteUserProfile = async (): Promise<void> => {
    if (!userProfile) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await userService.deleteUserProfile(userId);
      setUserProfile(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete user profile';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load existing user profile
   */
  const loadUserProfile = async (): Promise<UserProfile | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const profile = await userService.getUserProfile(userId);
      setUserProfile(profile);
      return profile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load user profile';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check if a username is available
   */
  const checkUsernameAvailability = async (username: string): Promise<boolean> => {
    try {
      return await userService.isUsernameAvailable(username, userId);
    } catch (error) {
      console.error('Failed to check username availability:', error);
      return false;
    }
  };

  /**
   * Update the current user's ID
   */
  const updateUserId = async (newUserId: string): Promise<UserProfile> => {
    if (!userProfile) {
      throw new Error('No user profile to update');
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedProfile = await userService.updateUserId(userId, newUserId);
      setUserProfile(updatedProfile);
      setUserId(newUserId);
      return updatedProfile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update user ID';
      setError(errorMessage);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Store userId received from server events
   */
  const storeReceivedUserId = (newUserId: string) => {
    console.log('Storing received userId:', newUserId);
    setReceivedUserId(newUserId);
  };

  /**
   * Clear any errors
   */
  const clearError = () => {
    setError(null);
  };

  return {
    userProfile,
    userId,
    isLoading,
    error,
    createUserProfile,
    updateUserProfile,
    updateUserId,
    storeReceivedUserId,
    deleteUserProfile,
    loadUserProfile,
    checkUsernameAvailability,
    clearError
  };
}; 