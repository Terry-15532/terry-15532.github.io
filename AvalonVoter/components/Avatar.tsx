import React from 'react';

interface AvatarProps {
  seed: string; // Expecting a Hex Color String
  size?: number;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ seed, size = 40, className = '' }) => {
  // Fallback if seed isn't a color (legacy support or error prevention)
  const color = seed.startsWith('#') ? seed : '#6366f1'; 

  return (
    <div
      className={`rounded-full shadow-md border-2 border-white/10 flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${color}, ${color}aa)`,
      }}
    />
  );
};

export default Avatar;