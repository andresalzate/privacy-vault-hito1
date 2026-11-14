import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach } from 'vitest';
import App from '../App.jsx';

beforeEach(() => {
  global.fetch = vi.fn(async (url, opts = {}) => {
    const key = opts.headers?.['x-api-key'];
    if (url.endsWith('/api/v1/secure-chat')) {
      if (!key) return { ok: false, status: 401, json: async () => ({ error: 'no_autenticado' }) };
      return { ok: true, json: async () => ({ anonymizedMessage: 'Soy NAME_aaaaaaaaaaaa', entities: [{ type: 'NAME', token: 'NAME_aaaaaaaaaaaa' }], aiResponse: 'Hola NAME_aaaaaaaaaaaa', finalResponse: 'Hola María', integrity: { sent: 1, preserved: 1, repaired: 0, missing: [], invented: [] }, provider: { name: 'mock', model: 'mock' } }) };
    }
    if (url.endsWith('/api/v1/detect')) return { ok: true, json: async () => ({ entities: [{ type: 'NAME', start: 4, end: 9 }], stored: false }) };
    return { ok: false, status: 404, json: async () => ({}) };
  });
});

test('operador: la consulta segura muestra texto anonimizado, integridad y respuesta restaurada', async () => {
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: /consulta segura/i }));
  expect(await screen.findByText('Hola María')).toBeInTheDocument();
  expect(screen.getAllByText('NAME_aaaaaaaaaaaa').length).toBeGreaterThan(0);
  expect(screen.getByText(/Conservados: 1/)).toBeInTheDocument();
});

test('visitante: puede detectar pero no consultar la IA, y la vista de auditoría está restringida', async () => {
  render(<App />);
  await userEvent.selectOptions(screen.getByLabelText('Rol'), 'visitante');
  await userEvent.click(screen.getByRole('button', { name: /detectar/i }));
  expect(await screen.findByText(/Datos personales detectados \(1\)/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /consulta segura/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/solo puedes detectar/);
  await userEvent.click(screen.getByRole('button', { name: /auditoría/i }));
  expect(screen.getByText(/requiere el rol/)).toBeInTheDocument();
});
