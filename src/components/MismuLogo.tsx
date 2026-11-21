import React from 'react';

interface MismuLogoProps {
  size?: 'sm' | 'md' | 'lg';
}

export const MismuLogo: React.FC<MismuLogoProps> = ({ size = 'md' }) => {
  const iconDims =
    size === 'sm' ? 'w-7 h-7' : size === 'lg' ? 'w-10 h-10' : 'w-8 h-8';
  const textClass =
    size === 'sm'
      ? 'text-lg font-extrabold tracking-tight'
      : size === 'lg'
      ? 'text-2xl font-extrabold tracking-tight'
      : 'text-xl font-extrabold tracking-tight';

  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${iconDims} shrink-0`}
        aria-hidden="true"
      >
        <rect width="40" height="40" rx="10" fill="#FF5A1F" />
        <path
          d="M9.5 28.5V12.5C9.5 11.6716 10.1716 11 11 11H13.4C14.0124 11 14.5625 11.3724 14.7903 11.9408L20 24.94L25.2097 11.9408C25.4375 11.3724 25.9876 11 26.6 11H29C29.8284 11 30.5 11.6716 30.5 12.5V28.5"
          stroke="#FFFFFF"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="12.5" r="2.2" fill="#FEF08A" />
      </svg>
      <span className={`font-display text-slate-900 ${textClass}`}>
        Mismu
      </span>
    </span>
  );
};
