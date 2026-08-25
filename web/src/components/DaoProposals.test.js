import { render, screen } from '@testing-library/react';
import axios from 'axios';
import apiClient from '../api/client';
import DaoProposals from './DaoProposals';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
  })),
}));

jest.mock('../api/client', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const apiGet = axios.create.mock.results[0].value.get;

beforeEach(() => {
  apiClient.get.mockResolvedValue({
    data: {
      data: [
        {
          id: 101,
          gauges: [],
          gaugeValidations: [],
          gaugeValidationStatus: 'not_applicable',
        },
        {
          id: 102,
          gauges: ['0xbe0451815b546F705ef3f398B8179aE3AADDA14e'],
          gaugeValidations: [
            {
              gauge: '0xbe0451815b546F705ef3f398B8179aE3AADDA14e',
              valid: true,
            },
          ],
          gaugeValidationStatus: 'valid',
        },
      ],
    },
  });
  apiGet.mockImplementation((url) => {
    return Promise.resolve({ data: { proposals: [] } });
  });
});

afterEach(() => {
  apiGet.mockReset();
  apiClient.get.mockReset();
});

test('renders every active proposal without labeling proposals that have no gauges', async () => {
  render(<DaoProposals />);

  expect(await screen.findByText('#101')).toBeInTheDocument();
  expect(screen.getByText('#102')).toBeInTheDocument();
  expect(screen.queryByText('No gauge additions')).not.toBeInTheDocument();
  expect(screen.getByText('0xbe04...A14e')).toBeInTheDocument();
});
