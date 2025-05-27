export interface UserProfile {
  id?: string;
  userId: string;
  username: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserProfileData {
  userId: string;
  username: string;
}

export interface UpdateUserProfileData {
  username?: string;
} 