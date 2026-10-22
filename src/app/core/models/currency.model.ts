/** Currencies an account can hold. Totals across accounts are shown in pesos. */
export type Currency = 'CLP' | 'USD' | 'UF';

export const BASE_CURRENCY: Currency = 'CLP';

export const CURRENCIES: { code: Currency; label: string }[] = [
  { code: 'CLP', label: 'Pesos (CLP)' },
  { code: 'USD', label: 'Dólares (USD)' },
  { code: 'UF', label: 'UF' },
];

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.some(c => c.code === value);
}

/** Value in pesos of one unit of each foreign currency; null while unknown. */
export interface ExchangeRates {
  USD: number | null;
  UF: number | null;
  /** Day the values are from, as 'YYYY-MM-DD'. */
  date: string | null;
  /** Whether the values came from mindicador.cl or were typed by the user. */
  source: 'auto' | 'manual' | null;
}

export const NO_RATES: ExchangeRates = { USD: null, UF: null, date: null, source: null };

const FORMATS: Record<Currency, Intl.NumberFormat> = {
  CLP: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }),
  USD: new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }),
  UF: new Intl.NumberFormat('es-CL', { minimumFractionDigits: 0, maximumFractionDigits: 4 }),
};

/** Formats an amount in its own currency, e.g. $12.500, US$1.234,5 or UF 2,35. */
export function formatMoney(amount: number, currency: Currency = BASE_CURRENCY): string {
  const text = FORMATS[currency].format(amount);
  return currency === 'UF' ? `UF ${text}` : text;
}
