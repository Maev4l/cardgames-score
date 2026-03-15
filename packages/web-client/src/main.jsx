import { Amplify } from 'aws-amplify';
import { amplifyConfig } from '@/config/cognito';

// Configure Amplify (must be before any auth imports)
Amplify.configure(amplifyConfig);

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
