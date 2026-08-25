import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: { data: {} } })),
  create: jest.fn(() => ({
    get: jest.fn(() => Promise.resolve({ data: { proposals: [] } })),
  })),
}));

jest.mock('./api/client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(() => Promise.resolve({ data: {} })),
  },
}));

test('renders the CRV.LOL header', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'CRV.LOL' })).toBeInTheDocument();
});
