export type Locale = "pl" | "en" | "de";
export type Instrument = {
  venue: string;
  market: string;
  symbol: string;
  timeframe: string;
};
export type Candle = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed: boolean;
};
export type Ticker = {
  symbol: string;
  price: number;
  change: number;
  volume: number;
};
export type User = {
  id: string;
  email?: string;
  wallet_address?: string;
  locale: Locale;
  timezone: string;
  role: string;
  has_password: boolean;
  two_factor: boolean;
};
export type Session = {
  accessToken: string;
  expiresAt: string;
  baseUrl: string;
};
export type Api = {
  baseUrl: string;
  setToken: (token: string | null) => void;
  request: (
    path: string,
    options?: { method?: string; body?: unknown; key?: string },
  ) => Promise<any>;
};
export type Agent = {
  id: string;
  name: string;
  provider: string;
  model: string;
};
export type JournalEntry = {
  id: string;
  symbol: string;
  side: string;
  entry: string;
  exit: string;
  quantity: string;
  fees: string;
  notes: string;
  created_at: string;
};
export type PaperOrder = {
  id: string;
  symbol: string;
  direction: string;
  quantity: string;
  fill_price: string | null;
  limit_price: string | null;
  stop_loss: string | null;
  take_profit: string | null;
  version: number;
  status: string;
  reserved: string;
  pending_exit: string | null;
  pnl: string | null;
};
export type PaperOverview = {
  account: { balance: string };
  equity: number | null;
  reserved: number;
  complete: boolean;
  updatedAt: string;
  engineActive: boolean;
  orders: PaperOrder[];
  exits: {
    id: string;
    symbol: string;
    quantity: string;
    price: string;
    pnl: string;
    created_at: string;
  }[];
  stats: {
    realizedPnl: number;
    unrealizedPnl: number | null;
    winRate: number | null;
    profitFactor: number | null;
    closedTrades: number;
  };
};
