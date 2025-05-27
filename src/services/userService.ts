import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { UserProfile, CreateUserProfileData, UpdateUserProfileData } from '../types/user';

export class UserService {
  private usersCollection = 'users';

  /**
   * Generate a unique user ID
   */
  generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new user profile
   */
  async createUserProfile(data: CreateUserProfileData): Promise<UserProfile> {
    try {
      const userProfileData = {
        userId: data.userId,
        username: data.username,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, this.usersCollection), userProfileData);
      
      return {
        id: docRef.id,
        ...userProfileData,
        createdAt: new Date(),
        updatedAt: new Date()
      } as UserProfile;
    } catch (error) {
      console.error('Failed to create user profile:', error);
      throw error;
    }
  }

  /**
   * Get user profile by user ID
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const q = query(
        collection(db, this.usersCollection),
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as UserProfile;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, data: UpdateUserProfileData): Promise<UserProfile> {
    try {
      const existingProfile = await this.getUserProfile(userId);
      if (!existingProfile) {
        throw new Error('User profile not found');
      }

      const updateData: any = {
        updatedAt: serverTimestamp()
      };

      if (data.username) {
        updateData.username = data.username;
      }

      await updateDoc(doc(db, this.usersCollection, existingProfile.id!), updateData);

      return {
        ...existingProfile,
        ...updateData,
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  }

  /**
   * Update user ID for an existing profile
   */
  async updateUserId(oldUserId: string, newUserId: string): Promise<UserProfile> {
    try {
      const existingProfile = await this.getUserProfile(oldUserId);
      if (!existingProfile) {
        throw new Error('User profile not found');
      }

      const updateData = {
        userId: newUserId,
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, this.usersCollection, existingProfile.id!), updateData);

      return {
        ...existingProfile,
        userId: newUserId,
        updatedAt: new Date()
      };
    } catch (error) {
      console.error('Failed to update user ID:', error);
      throw error;
    }
  }

  /**
   * Delete user profile and associated data
   */
  async deleteUserProfile(userId: string): Promise<void> {
    try {
      const existingProfile = await this.getUserProfile(userId);
      if (!existingProfile) {
        return; // Profile doesn't exist, nothing to delete
      }

      // Delete user document from Firestore
      await deleteDoc(doc(db, this.usersCollection, existingProfile.id!));
    } catch (error) {
      console.error('Failed to delete user profile:', error);
      throw error;
    }
  }

  /**
   * Check if username is available
   */
  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    try {
      const q = query(
        collection(db, this.usersCollection),
        where('username', '==', username)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return true;
      }

      // If excluding a specific user ID (for updates), check if the username belongs to that user
      if (excludeUserId) {
        const docs = querySnapshot.docs;
        return docs.every(doc => doc.data().userId === excludeUserId);
      }

      return false;
    } catch (error) {
      console.error('Failed to check username availability:', error);
      throw error;
    }
  }
}

export const userService = new UserService(); 