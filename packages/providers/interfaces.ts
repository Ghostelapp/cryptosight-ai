export type Venue = 'binance'|'bybit'|'okx';
export type Market = 'spot'|'perpetual';
export type Locale = 'en'|'pl'|'de';
export interface Instrument { venue: Venue; market: Market; symbol: string; base: string; quote: string; tickSize: string; quantityStep: string; }
export interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; closed: boolean; }
export interface Provenance { source: string; observedAt: string; fetchedAt: string; stale: boolean; unavailableReason?: string; }
export interface Sourced<T> { value: T|null; provenance: Provenance; }
export interface Subscription { close(): Promise<void>; }
export interface MarketProvider {
 readonly venue: Venue;
 instruments(market: Market, signal: AbortSignal): Promise<Instrument[]>;
 history(input: {instrument: Instrument; timeframe: string; from: number; to: number; cursor?: string}, signal: AbortSignal): Promise<{candles: Candle[]; nextCursor?: string}>;
 subscribe(instrument: Instrument, timeframe: string, onEvent: (event: MarketEvent)=>void, signal: AbortSignal): Promise<Subscription>;
 derivatives(instrument: Instrument, signal: AbortSignal): Promise<Sourced<{funding: number; openInterest: number; longShortRatio: number}>>;
}
export type MarketEvent = {type:'candle'; candle:Candle; sequence:number; instrument:Instrument}|{type:'status'; state:'connecting'|'live'|'stale'|'offline'; reason?:string};
export interface ContextProvider<T> {fetch(signal:AbortSignal):Promise<Sourced<T>>;}
export interface AIProvider {readonly name:string; analyze(input:{model:string;systemPrompt:string;snapshot:unknown;locale:Locale;maxOutputTokens:number;credential:string;schema:unknown},signal:AbortSignal):Promise<{output:unknown;inputTokens:number;outputTokens:number;costUsd:number}>;}
// Credentials are supplied only inside the server/worker process; never browser DTOs.
