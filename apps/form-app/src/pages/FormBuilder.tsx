import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TypographyH1, TypographyH2, TypographyP } from '@dculus/ui';
import { useTranslation } from '../hooks/useTranslation';

const FormBuilder: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('formBuilder');

  return (
    <div>
      <TypographyH1>{t('title')}</TypographyH1>
      <div>
        <div>
          <TypographyH2>{t('subtitle')}</TypographyH2>
        </div>
        <div>
          <TypographyP>{t('description')}</TypographyP>
          <div>
            <div>
              <label htmlFor="form-title">{t('fields.title.label')}</label>
              <input id="form-title" placeholder={t('fields.title.placeholder')} />
            </div>
            <div>
              <label htmlFor="form-description">{t('fields.description.label')}</label>
              <textarea id="form-description" placeholder={t('fields.description.placeholder')} rows={3} />
            </div>
            <div>
              <button onClick={() => navigate('/forms')}>{t('actions.save')}</button>
              <button onClick={() => navigate('/forms')}>{t('actions.cancel')}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormBuilder; 