import { useState } from 'react';
import { ROLES } from './api.js';
import OperatorPanel from './components/OperatorPanel.jsx';
import AuditorPanel from './components/AuditorPanel.jsx';

export default function App() {
  const [role, setRole] = useState('operador');
  const [view, setView] = useState('operar');
  return (
    <>
      <header className="topbar">
        <div className="brand"><span className="logo">BA</span> Banco Andino <small>Privacy Vault v2 · PoC Hito 1</small></div>
        <label className="role">
          <span>Rol</span>
          <select aria-label="Rol" value={role} onChange={(e) => setRole(e.target.value)}>
            {Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
          </select>
        </label>
      </header>
      <nav className="tabs" aria-label="Vistas">
        <button className={view === 'operar' ? 'tab on' : 'tab'} onClick={() => setView('operar')}>Anonimizar y consultar IA</button>
        <button className={view === 'auditar' ? 'tab on' : 'tab'} onClick={() => setView('auditar')}>Auditoría</button>
      </nav>
      <p className="banner">Demostración con datos ficticios. No usar con datos reales de clientes sin revisión de seguridad y Habeas Data.</p>
      <main>{view === 'operar' ? <OperatorPanel role={role} /> : <AuditorPanel role={role} />}</main>
    </>
  );
}
