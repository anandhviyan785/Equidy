// Reference dataset used by the simulated market engine and the offline analysis engine.
// Figures are illustrative approximations (USD, fiscal-year basis) — not live market data.

export type Sector =
  | "Technology"
  | "Communication"
  | "Consumer Discretionary"
  | "Consumer Staples"
  | "Financials"
  | "Healthcare"
  | "Energy"
  | "Industrials"
  | "Utilities"
  | "Real Estate"
  | "Materials"
  | "ETF"
  | "Crypto";

export interface Security {
  symbol: string;
  name: string;
  sector: Sector;
  price: number; // reference price
  beta: number;
  vol: number; // annualised volatility (0.25 = 25%)
  drift: number; // annualised expected return used by the simulator
  marketCap?: number; // USD billions
  pe?: number;
  dividendYield?: number; // %
  description: string;
  financials?: {
    years: number[];
    revenue: number[]; // USD billions
    netIncome: number[]; // USD billions
    freeCashFlow: number[]; // USD billions
    grossMargin: number; // %
    operatingMargin: number; // %
    debtToEquity: number;
    roe: number; // %
  };
}

const Y = [2021, 2022, 2023, 2024, 2025];

export const SECURITIES: Security[] = [
  {
    symbol: "AAPL", name: "Apple Inc.", sector: "Technology", price: 231.4, beta: 1.18, vol: 0.24, drift: 0.11,
    marketCap: 3480, pe: 33.1, dividendYield: 0.45,
    description: "Designs consumer hardware (iPhone, Mac, iPad, Wearables) and a fast-growing high-margin Services ecosystem.",
    financials: { years: Y, revenue: [365.8, 394.3, 383.3, 391.0, 416.2], netIncome: [94.7, 99.8, 97.0, 93.7, 112.0], freeCashFlow: [93.0, 111.4, 99.6, 108.8, 98.8], grossMargin: 46.9, operatingMargin: 32.0, debtToEquity: 1.45, roe: 151 },
  },
  {
    symbol: "MSFT", name: "Microsoft Corporation", sector: "Technology", price: 438.2, beta: 0.92, vol: 0.22, drift: 0.13,
    marketCap: 3260, pe: 35.4, dividendYield: 0.72,
    description: "Enterprise software and cloud leader spanning Azure, Microsoft 365, LinkedIn, Gaming and AI infrastructure.",
    financials: { years: Y, revenue: [168.1, 198.3, 211.9, 245.1, 281.7], netIncome: [61.3, 72.7, 72.4, 88.1, 101.8], freeCashFlow: [56.1, 65.1, 59.5, 74.1, 71.6], grossMargin: 69.4, operatingMargin: 45.6, debtToEquity: 0.33, roe: 33 },
  },
  {
    symbol: "NVDA", name: "NVIDIA Corporation", sector: "Technology", price: 182.6, beta: 1.72, vol: 0.48, drift: 0.22,
    marketCap: 4450, pe: 51.2, dividendYield: 0.02,
    description: "Accelerated computing platform: data-center GPUs, networking and the CUDA software stack powering AI workloads.",
    financials: { years: Y, revenue: [16.7, 26.9, 27.0, 60.9, 130.5], netIncome: [4.3, 9.8, 4.4, 29.8, 72.9], freeCashFlow: [4.7, 8.1, 3.8, 27.0, 60.9], grossMargin: 75.0, operatingMargin: 62.4, debtToEquity: 0.13, roe: 119 },
  },
  {
    symbol: "GOOGL", name: "Alphabet Inc.", sector: "Communication", price: 194.3, beta: 1.05, vol: 0.28, drift: 0.12,
    marketCap: 2370, pe: 22.4, dividendYield: 0.42,
    description: "Search, YouTube, Android and Google Cloud, with long-dated bets in autonomous driving and AI research.",
    financials: { years: Y, revenue: [257.6, 282.8, 307.4, 350.0, 384.5], netIncome: [76.0, 60.0, 73.8, 100.1, 118.0], freeCashFlow: [67.0, 60.0, 69.5, 72.8, 74.0], grossMargin: 58.6, operatingMargin: 32.1, debtToEquity: 0.10, roe: 32 },
  },
  {
    symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Discretionary", price: 221.8, beta: 1.15, vol: 0.30, drift: 0.12,
    marketCap: 2340, pe: 38.7,
    description: "Global e-commerce, logistics and advertising operator; AWS is the largest public cloud by revenue.",
    financials: { years: Y, revenue: [469.8, 514.0, 574.8, 638.0, 691.3], netIncome: [33.4, -2.7, 30.4, 59.2, 72.0], freeCashFlow: [-9.1, -11.6, 36.8, 38.2, 30.1], grossMargin: 48.9, operatingMargin: 10.8, debtToEquity: 0.54, roe: 24 },
  },
  {
    symbol: "META", name: "Meta Platforms Inc.", sector: "Communication", price: 612.5, beta: 1.25, vol: 0.36, drift: 0.13,
    marketCap: 1540, pe: 26.9, dividendYield: 0.33,
    description: "Operates Facebook, Instagram, WhatsApp and Threads; investing heavily in AI and Reality Labs.",
    financials: { years: Y, revenue: [117.9, 116.6, 134.9, 164.5, 189.0], netIncome: [39.4, 23.2, 39.1, 62.4, 70.1], freeCashFlow: [39.1, 19.0, 43.0, 52.1, 48.0], grossMargin: 81.7, operatingMargin: 41.5, debtToEquity: 0.27, roe: 36 },
  },
  {
    symbol: "TSLA", name: "Tesla Inc.", sector: "Consumer Discretionary", price: 268.9, beta: 2.05, vol: 0.58, drift: 0.10,
    marketCap: 860, pe: 92.0,
    description: "Electric vehicles, battery storage and solar, with autonomy and robotics programmes.",
    financials: { years: Y, revenue: [53.8, 81.5, 96.8, 97.7, 99.1], netIncome: [5.5, 12.6, 15.0, 7.1, 6.2], freeCashFlow: [5.0, 7.6, 4.4, 3.6, 4.1], grossMargin: 17.9, operatingMargin: 7.2, debtToEquity: 0.18, roe: 10 },
  },
  {
    symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials", price: 248.1, beta: 1.08, vol: 0.22, drift: 0.09,
    marketCap: 700, pe: 12.8, dividendYield: 2.1,
    description: "Largest U.S. bank by assets; consumer banking, investment banking, asset & wealth management.",
    financials: { years: Y, revenue: [121.6, 128.7, 158.1, 177.6, 182.4], netIncome: [48.3, 37.7, 49.6, 58.5, 57.0], freeCashFlow: [78.1, 107.1, 12.9, -42.0, 15.0], grossMargin: 0, operatingMargin: 41.0, debtToEquity: 1.25, roe: 17 },
  },
  {
    symbol: "V", name: "Visa Inc.", sector: "Financials", price: 312.4, beta: 0.95, vol: 0.19, drift: 0.10,
    marketCap: 610, pe: 30.2, dividendYield: 0.75,
    description: "Global card-payments network earning fees on transaction volume and cross-border flows.",
    financials: { years: Y, revenue: [24.1, 29.3, 32.7, 35.9, 39.6], netIncome: [12.3, 15.0, 17.3, 19.7, 21.8], freeCashFlow: [14.5, 17.9, 19.7, 18.7, 21.2], grossMargin: 80.4, operatingMargin: 67.0, debtToEquity: 0.52, roe: 51 },
  },
  {
    symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare", price: 156.7, beta: 0.52, vol: 0.16, drift: 0.06,
    marketCap: 377, pe: 15.4, dividendYield: 3.2,
    description: "Diversified healthcare: innovative medicine and med-tech, with a long dividend growth record.",
    financials: { years: Y, revenue: [78.7, 79.6, 85.2, 88.8, 91.5], netIncome: [20.9, 17.9, 35.2, 14.1, 21.0], freeCashFlow: [19.8, 17.2, 18.2, 19.8, 19.0], grossMargin: 69.1, operatingMargin: 26.0, debtToEquity: 0.52, roe: 20 },
  },
  {
    symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare", price: 342.0, beta: 0.60, vol: 0.30, drift: 0.07,
    marketCap: 310, pe: 14.6, dividendYield: 2.5,
    description: "Largest U.S. health insurer (UnitedHealthcare) plus Optum health services and data.",
    financials: { years: Y, revenue: [287.6, 324.2, 371.6, 400.3, 430.0], netIncome: [17.3, 20.1, 22.4, 14.4, 15.0], freeCashFlow: [20.0, 23.4, 26.2, 20.7, 18.0], grossMargin: 23.0, operatingMargin: 7.5, debtToEquity: 0.78, roe: 15 },
  },
  {
    symbol: "XOM", name: "Exxon Mobil Corporation", sector: "Energy", price: 112.3, beta: 0.85, vol: 0.25, drift: 0.06,
    marketCap: 480, pe: 14.2, dividendYield: 3.5,
    description: "Integrated oil & gas major across upstream production, refining and chemicals.",
    financials: { years: Y, revenue: [285.6, 413.7, 344.6, 339.2, 330.0], netIncome: [23.0, 55.7, 36.0, 33.7, 30.1], freeCashFlow: [36.1, 62.1, 36.1, 30.7, 27.5], grossMargin: 31.0, operatingMargin: 14.1, debtToEquity: 0.16, roe: 13 },
  },
  {
    symbol: "KO", name: "The Coca-Cola Company", sector: "Consumer Staples", price: 69.8, beta: 0.55, vol: 0.14, drift: 0.06,
    marketCap: 300, pe: 24.0, dividendYield: 2.9,
    description: "Global beverage brand portfolio with an asset-light concentrate model and 60+ years of dividend increases.",
    financials: { years: Y, revenue: [38.7, 43.0, 45.8, 47.1, 48.4], netIncome: [9.8, 9.5, 10.7, 10.6, 12.2], freeCashFlow: [11.3, 9.5, 9.7, 4.7, 9.9], grossMargin: 60.6, operatingMargin: 29.0, debtToEquity: 1.6, roe: 40 },
  },
  {
    symbol: "PG", name: "Procter & Gamble", sector: "Consumer Staples", price: 164.2, beta: 0.42, vol: 0.14, drift: 0.06,
    marketCap: 385, pe: 25.5, dividendYield: 2.5,
    description: "Household and personal-care staples (Tide, Pampers, Gillette) with strong pricing power.",
    financials: { years: Y, revenue: [76.1, 80.2, 82.0, 84.0, 84.3], netIncome: [14.3, 14.7, 14.7, 14.9, 16.0], freeCashFlow: [15.6, 13.6, 13.8, 16.5, 14.0], grossMargin: 51.4, operatingMargin: 24.3, debtToEquity: 0.68, roe: 31 },
  },
  {
    symbol: "CAT", name: "Caterpillar Inc.", sector: "Industrials", price: 388.0, beta: 1.10, vol: 0.27, drift: 0.09,
    marketCap: 185, pe: 18.0, dividendYield: 1.5,
    description: "Construction, mining and energy equipment leader with a large dealer and services network.",
    financials: { years: Y, revenue: [51.0, 59.4, 67.1, 64.8, 63.0], netIncome: [6.5, 6.7, 10.3, 10.8, 9.5], freeCashFlow: [6.1, 5.8, 10.6, 9.9, 8.2], grossMargin: 35.0, operatingMargin: 20.0, debtToEquity: 1.9, roe: 55 },
  },
  {
    symbol: "NEE", name: "NextEra Energy", sector: "Utilities", price: 74.5, beta: 0.65, vol: 0.22, drift: 0.07,
    marketCap: 153, pe: 21.0, dividendYield: 2.9,
    description: "Largest U.S. utility by market value and a global leader in wind and solar generation.",
    financials: { years: Y, revenue: [17.1, 21.0, 28.1, 24.8, 26.0], netIncome: [3.6, 4.1, 7.3, 6.9, 7.2], freeCashFlow: [-7.2, -9.0, -12.0, -8.5, -8.0], grossMargin: 60.0, operatingMargin: 30.0, debtToEquity: 1.6, roe: 10 },
  },
  {
    symbol: "O", name: "Realty Income", sector: "Real Estate", price: 57.9, beta: 0.80, vol: 0.20, drift: 0.06,
    marketCap: 51, pe: 54.0, dividendYield: 5.5,
    description: "Net-lease REIT paying monthly dividends from a diversified commercial property portfolio.",
  },
  {
    symbol: "LIN", name: "Linde plc", sector: "Materials", price: 462.0, beta: 0.88, vol: 0.18, drift: 0.08,
    marketCap: 218, pe: 33.0, dividendYield: 1.2,
    description: "World's largest industrial gases company serving healthcare, chemicals, electronics and energy.",
  },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", sector: "ETF", price: 668.0, beta: 1.0, vol: 0.16, drift: 0.09, dividendYield: 1.2, description: "Tracks the S&P 500 index of large-cap U.S. equities." },
  { symbol: "QQQ", name: "Invesco QQQ Trust", sector: "ETF", price: 598.0, beta: 1.15, vol: 0.21, drift: 0.11, dividendYield: 0.5, description: "Tracks the Nasdaq-100, weighted heavily toward large-cap technology." },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", sector: "ETF", price: 326.0, beta: 1.01, vol: 0.17, drift: 0.09, dividendYield: 1.3, description: "Broad exposure to the entire U.S. equity market across all capitalisations." },
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", sector: "ETF", price: 73.4, beta: 0.05, vol: 0.06, drift: 0.035, dividendYield: 3.7, description: "Investment-grade U.S. bonds: Treasuries, agencies and corporates." },
  { symbol: "GLD", name: "SPDR Gold Shares", sector: "ETF", price: 362.0, beta: 0.10, vol: 0.15, drift: 0.05, description: "Physically backed gold exposure, often used as a diversifier." },
  { symbol: "BTC", name: "Bitcoin", sector: "Crypto", price: 108500, beta: 1.6, vol: 0.55, drift: 0.15, description: "Decentralised digital asset with a fixed 21M supply cap." },
  { symbol: "ETH", name: "Ethereum", sector: "Crypto", price: 3850, beta: 1.8, vol: 0.70, drift: 0.14, description: "Programmable blockchain underpinning smart contracts and DeFi." },
];

export const INDICES = [
  { symbol: "SPX", name: "S&P 500", price: 6680, vol: 0.15, drift: 0.09 },
  { symbol: "NDX", name: "Nasdaq 100", price: 24620, vol: 0.2, drift: 0.11 },
  { symbol: "DJI", name: "Dow Jones", price: 46950, vol: 0.14, drift: 0.08 },
  { symbol: "RUT", name: "Russell 2000", price: 2470, vol: 0.22, drift: 0.07 },
  { symbol: "VIX", name: "Volatility Index", price: 16.4, vol: 0.9, drift: 0 },
  { symbol: "TNX", name: "US 10Y Yield", price: 4.08, vol: 0.18, drift: 0 },
];

export const BY_SYMBOL: Record<string, Security> = Object.fromEntries(SECURITIES.map((s) => [s.symbol, s]));

export function findSecurity(query: string): Security | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return (
    SECURITIES.find((s) => s.symbol.toLowerCase() === q) ??
    SECURITIES.find((s) => s.name.toLowerCase().startsWith(q)) ??
    SECURITIES.find((s) => s.name.toLowerCase().split(/[\s.,]+/)[0] === q)
  );
}
