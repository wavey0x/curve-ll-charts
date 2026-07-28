import { render, screen } from '@testing-library/react';
import axios from 'axios';
import Treasury from './Treasury';

jest.mock('axios', () => ({
  get: jest.fn(),
}));

beforeEach(() => {
  axios.get.mockResolvedValue({
    data: {
      grand_total_usd: '14',
      totals_are_partial: true,
      wallets: [
        {
          name: 'Treasury',
          address: '0x6508eF65b0Bd57eaBD0f1D52685A70433B2d290B',
          total_usd: '14',
          rows: [
            {
              label: 'sDOLA',
              symbol: 'sDOLA',
              token_address: '0xb45ad160634c528Cc3D2926d9807104FA3157305',
              kind: 'token',
              logo_url: '',
              balance: '10',
              usd_value: null,
              pricing_status: 'unpriced',
            },
          ],
        },
      ],
      footnotes: [],
    },
  });
});

afterEach(() => {
  axios.get.mockReset();
});

test('renders dynamically discovered holdings even when a price is unavailable', async () => {
  render(<Treasury />);

  expect(await screen.findByText('sDOLA')).toBeInTheDocument();
  expect(screen.getByText('Unpriced')).toBeInTheDocument();
  expect(screen.getByText('Total (priced assets)')).toBeInTheDocument();
});
