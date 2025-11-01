import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@dculus/ui';
import { useTranslation } from '../hooks/useTranslation';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('header');

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 
              onClick={() => navigate('/')}
              className="text-2xl font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
            >
              {t('appTitle')}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => navigate('/forms')}
            >
              {t('navigation.forms')}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => navigate('/demo')}
            >
              {t('navigation.demo')}
            </Button>
            <Button 
              onClick={() => navigate('/forms/new')}
            >
              + {t('navigation.newForm')}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header; 