"use client"

import React from 'react';

// Simple toaster implementation
export const toaster = {
  create: (options: { 
    title?: string; 
    description?: string; 
    type: 'success' | 'error' | 'warning' | 'info' 
  }) => {
    const message = options.description || options.title || 'Notification';
    console.log(`${options.type.toUpperCase()}: ${message}`);
    alert(`${options.type.toUpperCase()}: ${message}`);
  }
};

// Simple Toaster component
export const Toaster = () => {
  return <div></div>;
};
