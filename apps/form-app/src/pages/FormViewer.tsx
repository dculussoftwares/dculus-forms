import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';

const FormViewer: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation('formViewer');

  return (
    <div>
      <h1>{t('title')}</h1>
      <div>
        <div>
          <h2>{t('subtitle')}</h2>
          <p>{t('description', { values: { formId: id || 'N/A' } })}</p>
        </div>
        <div>
          <div>
            <label htmlFor="name">{t('fields.name.label')}</label>
            <input id="name" placeholder={t('fields.name.placeholder')} />
          </div>
          <div>
            <label htmlFor="email">{t('fields.email.label')}</label>
            <input id="email" type="email" placeholder={t('fields.email.placeholder')} />
          </div>
          <div>
            <label htmlFor="message">{t('fields.message.label')}</label>
            <textarea id="message" placeholder={t('fields.message.placeholder')} rows={4} />
          </div>
          <div>
            <button onClick={() => navigate('/forms')}>{t('actions.submit')}</button>
            <button onClick={() => navigate('/forms')}>{t('actions.cancel')}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormViewer; 