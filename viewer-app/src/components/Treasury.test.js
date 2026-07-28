import { fireEvent, render, screen } from '@testing-library/react';
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
            {
              label: 'sfrxUSD',
              symbol: 'sfrxUSD',
              token_address: '0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6',
              kind: 'token',
              logo_url: '',
              balance: '20',
              usd_value: '24',
              pricing_status: 'priced',
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

test('toggles every row between USD values and symbol-free token amounts', async () => {
  render(<Treasury />);

  expect(await screen.findByText('sDOLA')).toBeInTheDocument();
  expect(screen.getByText('Unpriced')).toBeInTheDocument();
  expect(screen.getByText('$24')).toBeInTheDocument();
  expect(screen.getByText('Total (priced assets)')).toBeInTheDocument();

  fireEvent.click(screen.getByText('sDOLA').closest('button'));

  expect(screen.getByText('10')).toBeInTheDocument();
  expect(screen.getByText('20')).toBeInTheDocument();
  expect(screen.queryByText('10 sDOLA')).not.toBeInTheDocument();
  expect(screen.queryByText('20 sfrxUSD')).not.toBeInTheDocument();
  expect(screen.queryByText('Unpriced')).not.toBeInTheDocument();
  expect(screen.queryByText('$24')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText('sfrxUSD').closest('button'));

  expect(screen.getByText('Unpriced')).toBeInTheDocument();
  expect(screen.getByText('$24')).toBeInTheDocument();
  expect(screen.queryByText('10')).not.toBeInTheDocument();
  expect(screen.queryByText('20')).not.toBeInTheDocument();
});
