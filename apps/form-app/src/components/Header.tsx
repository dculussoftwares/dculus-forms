import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@dculus/ui';

const Header: React.FC = () => {
  const navigate = useNavigate();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 
              onClick={() => navigate('/')}
              className="text-2xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
            >
              Dculus Forms
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/forms')}
            >
              Forms
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/demo')}
            >
              Demo
            </Button>
            <Button 
              onClick={() => navigate('/forms/new')}
            >
              + New Form
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 