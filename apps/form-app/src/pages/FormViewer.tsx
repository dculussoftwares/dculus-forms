import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const FormViewer: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div>
      <h1>Form Viewer</h1>
      <div>
        <div>
          <h2>Complete the Form</h2>
          <p>Form viewer functionality will be implemented here. Form ID: {id}</p>
        </div>
        <div>
          <div>
            <label htmlFor="name">Name</label>
            <input id="name" placeholder="Enter your name" />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" placeholder="Enter your email" />
          </div>
          <div>
            <label htmlFor="message">Message</label>
            <textarea id="message" placeholder="Enter your message" rows={4} />
          </div>
          <div>
            <button onClick={() => navigate('/forms')}>Submit</button>
            <button onClick={() => navigate('/forms')}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FormViewer; 