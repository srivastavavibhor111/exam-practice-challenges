import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// CSS import order matters:
// 1. Reset       — clears browser defaults
// 2. Tokens      — defines all CSS custom properties (theme variables)
// 3. Global      — applies tokens to base elements
// 4. App         — component-level styles (loaded via component imports)
import './styles/reset.css';
import './styles/tokens.css';
import './styles/global.css';

import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
