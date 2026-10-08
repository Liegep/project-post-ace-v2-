import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { LoginPage, PasswordResetPage } from '../src/LoginPage';
import { LOGIN_INTRO_KEY } from '../src/loginI18n';
import '../src/styles.css';

// Local visual harness only: each replay uses the real component and CSS.
// No auth API, app session, or production data is loaded by this page.
function Preview() {
  const [mount, setMount] = useState(0);
  const [reset, setReset] = useState(false);
  return <div className="app-shell">
    <nav aria-label="Revisão local" style={{ position: 'fixed', zIndex: 10, bottom: 8, left: 8, display: 'flex', gap: 8 }}>
      <button onClick={() => { sessionStorage.removeItem(LOGIN_INTRO_KEY); setReset(false); setMount(m => m + 1); }}>Nova sessão</button>
      <button onClick={() => { setReset(false); setMount(m => m + 1); }}>Reentrar</button>
      <button onClick={() => setReset(true)}>Reset</button>
    </nav>
    <MemoryRouter key={mount}>
      {reset ? <PasswordResetPage /> : <LoginPage session={null} redirectTo="/dashboard" onLogin={async () => false} />}
    </MemoryRouter>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Preview /></React.StrictMode>);
