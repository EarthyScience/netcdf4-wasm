import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface BrowzarrCTAProps {
  message?: string;
  buttonText?: string;
  className?: string;
}

export default function BrowzarrCTA({ 
  message = "Reading is just the beginning. Explore your data!",
  buttonText = "Try browzarr.io",
  className = ""
}: BrowzarrCTAProps) {
  return (
    <div className={`flex flex-col items-center gap-3 p-4 ${className}`}>
      <p className="text-center text-sm text-gray-600 dark:text-gray-400">
        {message}
      </p>
      <Link 
        aria-label="browzarr.io" 
        href="https://browzarr.io/"
        target="_blank"
        rel="noopener noreferrer"
      > 
        <Button 
          size="sm" 
          className="bg-gradient-to-tr from-pink-500 to-yellow-500 text-white shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
        >
          {buttonText}
        </Button>
      </Link>
    </div>
  );
}