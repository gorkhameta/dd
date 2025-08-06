import React from 'react';

const UFOImage = () => {
  return (
    <div className="flex items-center justify-center">
      <svg
        width="160"
        height="120"
        viewBox="0 0 160 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="opacity-60"
      >
        {/* UFO Body - Main ellipse */}
        <ellipse
          cx="80"
          cy="70"
          rx="70"
          ry="25"
          fill="currentColor"
          className="text-gray-400 dark:text-gray-600"
        />
        
        {/* UFO Dome */}
        <ellipse
          cx="80"
          cy="50"
          rx="35"
          ry="20"
          fill="currentColor"
          className="text-gray-300 dark:text-gray-500"
        />
        
        {/* UFO Bottom highlight */}
        <ellipse
          cx="80"
          cy="75"
          rx="60"
          ry="18"
          fill="currentColor"
          className="text-gray-500 dark:text-gray-700"
        />
        
        {/* Light beam */}
        <path
          d="M 60 85 L 50 110 L 110 110 L 100 85 Z"
          fill="currentColor"
          className="text-gray-200 dark:text-gray-800 opacity-40"
        />
        
        {/* UFO lights */}
        <circle cx="55" cy="70" r="3" fill="currentColor" className="text-gray-200 dark:text-gray-400" />
        <circle cx="80" cy="70" r="3" fill="currentColor" className="text-gray-200 dark:text-gray-400" />
        <circle cx="105" cy="70" r="3" fill="currentColor" className="text-gray-200 dark:text-gray-400" />
      </svg>
    </div>
  );
};

export default UFOImage;