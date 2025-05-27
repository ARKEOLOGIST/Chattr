# User Profile Feature

This feature allows users to create and manage their profiles with usernames and profile pictures stored in Firebase.

## Features

### ✅ User Profile Management
- **Create Profile**: Users create profiles during username entry with optional profile picture
- **Update Profile**: Users can change their profile picture from the chat interface
- **Delete Profile**: Profile is automatically deleted when users leave the room
- **Profile Pictures**: Images are stored in Firebase Storage with automatic cleanup

### ✅ Data Storage
- **Firestore Database**: User profiles stored in `users` collection
- **Firebase Storage**: Profile pictures stored in `profile-icons/` folder
- **Automatic Cleanup**: Old profile pictures are deleted when updated or profile is deleted

### ✅ User Experience
- **Integrated Flow**: Profile creation happens during username entry
- **Chat Interface**: Profile picture management accessible from chat header
- **Image Validation**: File type and size validation (max 5MB)
- **Preview**: Users can preview their selected image before uploading
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Technical Implementation

### Components
- `UsernameEntryScreen`: Enhanced with profile picture selection
- `ProfileManager`: Profile picture management component for chat interface
- `ChatHeader`: Updated to display profile picture and access profile manager
- `useUserProfile`: Custom hook for profile state management

### Services
- `UserService`: Handles all Firebase operations for user profiles
- Automatic file upload/deletion in Firebase Storage
- Username availability checking

### Data Flow
1. User starts create/join room flow
2. Username entry screen with optional profile picture selection
3. Profile data saved to Firestore, images to Storage during username submission
4. User enters chat with profile active and visible in header
5. Users can update profile picture via "Profile" button in chat header
6. Profile automatically deleted when user leaves (clicks "Leave" button)

## Firebase Setup

Make sure you have both Firestore Database and Firebase Storage enabled in your Firebase project:

1. **Firestore Database**: For storing user profile data
2. **Firebase Storage**: For storing profile pictures

See `FIREBASE_SETUP.md` for detailed setup instructions.

## Usage

The user profile feature is automatically integrated into the app flow:

1. **Create Room**: User creates profile → connects → creates room
2. **Join Room**: User creates profile → enters room ID → joins room
3. **Leave Room**: Profile is automatically deleted when user leaves

## File Structure

```
src/
├── types/
│   └── user.ts                 # User profile type definitions
├── services/
│   └── userService.ts          # Firebase operations for user profiles
├── hooks/
│   └── useUserProfile.ts       # Profile state management hook
├── components/
│   ├── UsernameEntryScreen.tsx # Enhanced with profile picture selection
│   ├── ProfileManager.tsx      # Profile picture management component
│   ├── ChatHeader.tsx          # Updated with profile display and management
│   ├── UserProfile.tsx         # Profile display/edit component (legacy)
│   └── UserProfileScreen.tsx   # Profile creation screen (legacy)
└── config/
    └── firebase.ts             # Updated with Storage configuration
```

## Security Notes

- Profile pictures are stored with unique filenames to prevent conflicts
- File type and size validation prevents malicious uploads
- Automatic cleanup ensures no orphaned files in storage
- User IDs are generated client-side for this demo (consider server-side generation for production)

## Future Enhancements

- User authentication integration
- Profile picture compression
- Multiple image formats support
- Profile visibility settings
- User search functionality 