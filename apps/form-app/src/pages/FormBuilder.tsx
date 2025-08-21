import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TypographyH1, TypographyH2, TypographyP } from '@dculus/ui';

const FormBuilder: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div>
      <TypographyH1>Form Builder</TypographyH1>
      <div>
        <div>
          <TypographyH2>Create New Form</TypographyH2>
        </div>
        <div>
          <TypographyP>Form builder functionality will be implemented here.</TypographyP>
          <div>
            <div>
              <label htmlFor="form-title">Form Title</label>
              <input id="form-title" placeholder="Enter form title" />
            </div>
            <div>
              <label htmlFor="form-description">Form Description</label>
              <textarea id="form-description" placeholder="Enter form description" rows={3} />
            </div>
            <div>
              <button onClick={() => navigate('/forms')}>Save Form</button>
              <button onClick={() => navigate('/forms')}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormBuilder; 