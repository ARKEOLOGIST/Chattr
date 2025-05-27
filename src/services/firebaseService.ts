import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  limit,
  startAfter,
  DocumentSnapshot,
  Timestamp,
  serverTimestamp,
  doc,
  updateDoc,
  increment,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';

export interface FirebaseMessage {
  id?: string;
  roomId: string;
  user: string;
  text: string;
  timestamp: Timestamp | number;
  isSystemMessage?: boolean;
  type?: string;
  createdAt?: Timestamp;
}

export interface FirebaseRoom {
  id?: string;
  roomId: string;
  roomName?: string;
  lastActivity: Timestamp;
  messageCount: number;
  participants: string[];
  createdAt: Timestamp;
  createdBy: string;
}

export class FirebaseMessageService {
  private messagesCollection = 'messages';
  private roomsCollection = 'rooms';

  /**
   * Save a message to Firestore
   */
  async saveMessage(message: Omit<FirebaseMessage, 'id' | 'createdAt'>): Promise<string> {
    try {
      const messageData = {
        ...message,
        timestamp: typeof message.timestamp === 'number' ? 
          Timestamp.fromMillis(message.timestamp) : message.timestamp,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, this.messagesCollection), messageData);
      
      // Update room activity and message count
      await this.updateRoomActivity(message.roomId, message.user);
      
      return docRef.id;
    } catch (error) {
      console.error('Failed to save message to Firebase:', error);
      throw error;
    }
  }

  /**
   * Load messages for a room with pagination
   */
  async loadRoomMessages(
    roomId: string, 
    limitCount: number = 50,
    lastDoc?: DocumentSnapshot
  ): Promise<{ messages: FirebaseMessage[], lastDoc?: DocumentSnapshot }> {
    try {
      let q = query(
        collection(db, this.messagesCollection),
        where('roomId', '==', roomId),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );

      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const querySnapshot = await getDocs(q);
      const messages: FirebaseMessage[] = [];
      let newLastDoc: DocumentSnapshot | undefined;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toMillis() || data.timestamp
        } as FirebaseMessage);
        newLastDoc = doc;
      });

      // Reverse to get chronological order (oldest first)
      return { 
        messages: messages.reverse(), 
        lastDoc: newLastDoc 
      };
    } catch (error) {
      console.error('Failed to load room messages from Firebase:', error);
      return { messages: [] };
    }
  }

  /**
   * Subscribe to real-time message updates for a room
   */
  subscribeToRoomMessages(
    roomId: string,
    callback: (messages: FirebaseMessage[]) => void,
    errorCallback?: (error: Error) => void
  ): () => void {
    try {
      const q = query(
        collection(db, this.messagesCollection),
        where('roomId', '==', roomId),
        orderBy('timestamp', 'asc')
      );

      return onSnapshot(
        q,
        (querySnapshot) => {
          const messages: FirebaseMessage[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data();
            messages.push({
              id: doc.id,
              ...data,
              timestamp: data.timestamp?.toMillis() || data.timestamp
            } as FirebaseMessage);
          });
          callback(messages);
        },
        (error) => {
          console.error('Error in message subscription:', error);
          if (errorCallback) errorCallback(error);
        }
      );
    } catch (error) {
      console.error('Failed to subscribe to room messages:', error);
      if (errorCallback) errorCallback(error as Error);
      return () => {}; // Return empty unsubscribe function
    }
  }

  /**
   * Create or update room information
   */
  async createOrUpdateRoom(roomData: {
    roomId: string;
    roomName?: string;
    createdBy: string;
  }): Promise<void> {
    try {
      // Check if room already exists
      const q = query(
        collection(db, this.roomsCollection),
        where('roomId', '==', roomData.roomId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Create new room
        await addDoc(collection(db, this.roomsCollection), {
          roomId: roomData.roomId,
          roomName: roomData.roomName || `Room ${roomData.roomId}`,
          lastActivity: serverTimestamp(),
          messageCount: 0,
          participants: [roomData.createdBy],
          createdAt: serverTimestamp(),
          createdBy: roomData.createdBy
        });
      } else {
        // Update existing room - add participant if not already present
        const roomDoc = querySnapshot.docs[0];
        const roomDocData = roomDoc.data();
        const participants = roomDocData.participants || [];
        
        if (!participants.includes(roomData.createdBy)) {
          await updateDoc(doc(db, this.roomsCollection, roomDoc.id), {
            participants: [...participants, roomData.createdBy],
            lastActivity: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error('Failed to create/update room:', error);
      throw error;
    }
  }

  /**
   * Update room activity and message count
   */
  private async updateRoomActivity(roomId: string, username: string): Promise<void> {
    try {
      const q = query(
        collection(db, this.roomsCollection),
        where('roomId', '==', roomId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const roomDoc = querySnapshot.docs[0];
        const roomDocData = roomDoc.data();
        const participants = roomDocData.participants || [];
        
        const updateData: any = {
          lastActivity: serverTimestamp(),
          messageCount: increment(1)
        };

        // Add user to participants if not already present
        if (!participants.includes(username)) {
          updateData.participants = [...participants, username];
        }

        await updateDoc(doc(db, this.roomsCollection, roomDoc.id), updateData);
      }
    } catch (error) {
      console.error('Failed to update room activity:', error);
    }
  }

  /**
   * Get all rooms ordered by last activity
   */
  async getAllRooms(): Promise<FirebaseRoom[]> {
    try {
      const q = query(
        collection(db, this.roomsCollection),
        orderBy('lastActivity', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const rooms: FirebaseRoom[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        rooms.push({
          id: doc.id,
          ...data
        } as FirebaseRoom);
      });
      
      return rooms;
    } catch (error) {
      console.error('Failed to load rooms from Firebase:', error);
      return [];
    }
  }

  /**
   * Get room information by roomId
   */
  async getRoomInfo(roomId: string): Promise<FirebaseRoom | null> {
    try {
      const q = query(
        collection(db, this.roomsCollection),
        where('roomId', '==', roomId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        return {
          id: doc.id,
          ...data
        } as FirebaseRoom;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get room info:', error);
      return null;
    }
  }

  /**
   * Clear all messages for a room (admin function)
   */
  async clearRoomMessages(roomId: string): Promise<void> {
    try {
      const q = query(
        collection(db, this.messagesCollection),
        where('roomId', '==', roomId)
      );
      
      const querySnapshot = await getDocs(q);
      
      // Note: In a production app, you'd want to use batch operations
      // or Cloud Functions for better performance with large datasets
      const deletePromises = querySnapshot.docs.map(docSnapshot => 
        deleteDoc(docSnapshot.ref)
      );
      
      await Promise.all(deletePromises);
      
      // Reset room message count
      const roomInfo = await this.getRoomInfo(roomId);
      if (roomInfo && roomInfo.id) {
        await updateDoc(doc(db, this.roomsCollection, roomInfo.id), {
          messageCount: 0,
          lastActivity: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Failed to clear room messages:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const firebaseMessageService = new FirebaseMessageService(); 