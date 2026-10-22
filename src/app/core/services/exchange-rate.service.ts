import { Injectable, inject, signal } from '@angular/core';
import { Currency, ExchangeRates, NO_RATES } from '../models/currency.model';
import { StorageService } from './storage.service';

const STORAGE_KEY = 'exchange_rates';
/** Free, keyless API with the Banco Central's daily values. */
export const RATES_URL = 'https://mindicador.cl/api';

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function positive(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** Reads the dollar and UF values out of a mindicador.cl response. */
export function parseIndicators(body: unknown): Pick<ExchangeRates, 'USD' | 'UF' | 'date'> | null {
  if (!body || typeof body !== 'object') return null;
  const data = body as Record<string, { valor?: unknown; fecha?: unknown } | undefined>;
  const USD = positive(data['dolar']?.valor);
  const UF = positive(data['uf']?.valor);
  if (USD === null || UF === null) return null;
  const date = typeof data['dolar']?.fecha === 'string' ? data['dolar'].fecha.slice(0, 10) : today();
  return { USD, UF, date };
}

/** Converts amounts to pesos with the day's dollar and UF values, fetched or typed by the user. */
@Injectable({ providedIn: 'root' })
export class ExchangeRateService {
  private readonly storage = inject(StorageService);

  readonly rates = signal<ExchangeRates>({ ...NO_RATES, ...this.storage.get<Partial<ExchangeRates>>(STORAGE_KEY, {}) });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Value in pesos of one unit of `currency`, or null when it isn't known yet. */
  rate(currency: Currency): number | null {
    return currency === 'CLP' ? 1 : this.rates()[currency];
  }

  /** `amount` in pesos; 0 when the currency's value isn't known yet. */
  toClp(amount: number, currency: Currency): number {
    return amount * (this.rate(currency) ?? 0);
  }

  /** Uses values typed by the user; automatic updates won't replace them until they ask for one. */
  setManual(rates: { USD: number | null; UF: number | null }): void {
    this.error.set(null);
    this.save({ USD: positive(rates.USD), UF: positive(rates.UF), date: today(), source: 'manual' });
  }

  /**
   * Fetches today's values unless the user typed their own or they are
   * already from today. `force` refetches anyway, replacing typed values.
   */
  async refresh(force = false): Promise<void> {
    const current = this.rates();
    if (!force && (current.source === 'manual' || (current.source === 'auto' && current.date === today()))) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await fetch(RATES_URL);
      const parsed = response.ok ? parseIndicators(await response.json()) : null;
      if (!parsed) throw new Error('bad response');
      this.save({ ...parsed, source: 'auto' });
    } catch {
      this.error.set('No se pudo obtener el valor del día. Puedes escribirlo a mano.');
    } finally {
      this.loading.set(false);
    }
  }

  private save(rates: ExchangeRates): void {
    this.rates.set(rates);
    this.storage.set(STORAGE_KEY, rates);
  }
}
