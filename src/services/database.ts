import Dexie, { Table } from 'dexie';

export interface ChatMessage {
  id?: number;
  roomId: string;
  user: string;
  text: string;
  timestamp: number;
  isSystemMessage?: boolean;
}

export interface ChatRoom {
  id?: number;
  roomId: string;
  roomName?: string;
  lastActivity: number;
  userCount?: number;
}

export class TelepartyStorage extends Dexie {
  messages!: Table<ChatMessage>;
  rooms!: Table<ChatRoom>;

  constructor() {
    // Call parent Dexie constructor with database name
    // This creates/opens an IndexedDB database called 'TelepartyChatDB'
    super('TelepartyChatDB');
    
    // Define database schema version 1
    // This tells Dexie how to structure our database tables
    this.version(1).stores({
      // Messages table: auto-incrementing ID + indexed fields for fast queries
      // '++id' = auto-increment primary key
      // 'roomId, user, timestamp' = indexed fields for fast searching/sorting
      messages: '++id, roomId, user, timestamp',
      
      // Rooms table: auto-incrementing ID + indexed fields
      // We index roomId and lastActivity for efficient room management
      rooms: '++id, roomId, lastActivity'
    });
    
    /* 
    How this works:
    1. IndexedDB is a browser's built-in database (like SQLite for web)
    2. Dexie is a wrapper that makes IndexedDB easier to use
    3. When this constructor runs, it either:
       - Opens existing database if it exists
       - Creates new database with our schema if it doesn't exist
    4. The indexed fields allow fast queries like "get all messages for room X"
    5. Data persists even when browser is closed/refreshed
    */
  }

  // Save a message to the database
  async saveMessage(message: Omit<ChatMessage, 'id'>) {
    try {
      await this.messages.add(message);
      
      // Update room last activity
      await this.updateRoomActivity(message.roomId);
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  }

  // Load all messages for a specific room
  async loadRoomMessages(roomId: string): Promise<ChatMessage[]> {
    try {
      return await this.messages
        .where('roomId')
        .equals(roomId)
        .toArray()
        .then(messages => messages.sort((a, b) => a.timestamp - b.timestamp));
    } catch (error) {
      console.error('Failed to load room messages:', error);
      return [];
    }
  }

  // Update room activity timestamp
  async updateRoomActivity(roomId: string) {
    try {
      const existingRoom = await this.rooms.where('roomId').equals(roomId).first();
      
      if (existingRoom) {
        await this.rooms.update(existingRoom.id!, { lastActivity: Date.now() });
      } else {
        await this.rooms.add({
          roomId,
          lastActivity: Date.now()
        });
      }
    } catch (error) {
      console.error('Failed to update room activity:', error);
    }
  }

  // Get all rooms ordered by last activity
  async getAllRooms(): Promise<ChatRoom[]> {
    try {
      return await this.rooms.orderBy('lastActivity').reverse().toArray();
    } catch (error) {
      console.error('Failed to load rooms:', error);
      return [];
    }
  }

  // Clear all messages for a specific room
  async clearRoomMessages(roomId: string) {
    try {
      await this.messages.where('roomId').equals(roomId).delete();
    } catch (error) {
      console.error('Failed to clear room messages:', error);
    }
  }

  // Get message count for a room
  async getRoomMessageCount(roomId: string): Promise<number> {
    try {
      return await this.messages.where('roomId').equals(roomId).count();
    } catch (error) {
      console.error('Failed to get message count:', error);
      return 0;
    }
  }
}

// Create and export database instance
export const chatDB = new TelepartyStorage(); 