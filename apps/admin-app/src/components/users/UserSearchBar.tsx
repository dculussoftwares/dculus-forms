import { Input } from '@dculus/ui';
import { Search } from 'lucide-react';
import { useState, useEffect } from 'react';

interface UserSearchBarProps {
  onSearch: (search: string) => void;
  placeholder?: string;
}

export const UserSearchBar = ({
  onSearch,
  placeholder = 'Search users by name or email...',
}: UserSearchBarProps) => {
  const [searchTerm, setSearchTerm] = useState('');

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, onSearch]);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
      <Input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-10 w-full"
      />
    </div>
  );
};
