import { useCallback } from 'react';

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const useUsernameValidation = () => {
  const validateUsername = useCallback((username: string): ValidationResult => {
    if (!username || !username.trim()) {
      return {
        isValid: false,
        error: 'Username is required'
      };
    }

    const trimmedUsername = username.trim();

    if (trimmedUsername.length < 2) {
      return {
        isValid: false,
        error: 'Username must be at least 2 characters long'
      };
    }

    if (trimmedUsername.length > 20) {
      return {
        isValid: false,
        error: 'Username must be less than 20 characters'
      };
    }

    // Check for valid characters (letters, numbers, spaces, hyphens, underscores)
    const validUsernameRegex = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validUsernameRegex.test(trimmedUsername)) {
      return {
        isValid: false,
        error: 'Username can only contain letters, numbers, spaces, hyphens, and underscores'
      };
    }

    // Check for inappropriate words (basic filter)
    const inappropriateWords = ['admin', 'system', 'bot', 'moderator', 'null', 'undefined'];
    const lowercaseUsername = trimmedUsername.toLowerCase();
    
    for (const word of inappropriateWords) {
      if (lowercaseUsername.includes(word)) {
        return {
          isValid: false,
          error: 'Username contains restricted words'
        };
      }
    }

    return {
      isValid: true
    };
  }, []);

  return {
    validateUsername
  };
}; 