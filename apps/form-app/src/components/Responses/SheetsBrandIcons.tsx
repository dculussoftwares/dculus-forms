import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement>;

export const GoogleSheetsIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
    <path d="M29 4H12a4 4 0 0 0-4 4v32a4 4 0 0 0 4 4h24a4 4 0 0 0 4-4V15L29 4z" fill="#0F9D58" />
    <path d="M29 4v7a4 4 0 0 0 4 4h7L29 4z" fill="#87CEAC" />
    <path
      fill="#fff"
      fillRule="evenodd"
      d="M15 22h18v12H15zM17 24h6v3h-6zM25 24h6v3h-6zM17 29h6v3h-6zM25 29h6v3h-6z"
    />
  </svg>
);

export const MicrosoftExcelIcon: React.FC<IconProps> = (props) => (
  <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
    <rect x="14" y="8" width="30" height="32" rx="3" fill="#21A366" />
    <path d="M30 18h9M30 24h9M30 30h9" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <rect x="4" y="12" width="24" height="24" rx="3" fill="#107C41" />
    <path fill="#fff" d="M10.5 18.5h3l2.5 4 2.5-4h3l-4 5.5 4 5.5h-3L16 25.5l-2.5 4h-3l4-5.5z" />
  </svg>
);
