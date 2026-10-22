import { TestBed } from '@angular/core/testing';
import { ExchangeRateService, RATES_URL, parseIndicators } from './exchange-rate.service';

const RESPONSE = {
  dolar: { codigo: 'dolar', valor: 950.5, fecha: '2026-10-22T03:00:00.000Z' },
  uf: { codigo: 'uf', valor: 39876.12, fecha: '2026-10-22T03:00:00.000Z' },
};

function mockFetch(body: unknown, ok = true) {
  const fetch = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

describe('parseIndicators', () => {
  it('should read the dollar and UF values', () => {
    expect(parseIndicators(RESPONSE)).toEqual({ USD: 950.5, UF: 39876.12, date: '2026-10-22' });
  });

  it('should reject responses without both values', () => {
    expect(parseIndicators({ dolar: { valor: 950 } })).toBeNull();
    expect(parseIndicators({ dolar: { valor: 'x' }, uf: { valor: 1 } })).toBeNull();
    expect(parseIndicators(null)).toBeNull();
  });
});

describe('ExchangeRateService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  afterEach(() => vi.unstubAllGlobals());

  it('should convert to pesos once the values are known', async () => {
    const fetch = mockFetch(RESPONSE);
    const service = TestBed.inject(ExchangeRateService);
    expect(service.toClp(10, 'USD')).toBe(0);
    expect(service.toClp(5000, 'CLP')).toBe(5000);

    await service.refresh();

    expect(fetch).toHaveBeenCalledWith(RATES_URL);
    expect(service.toClp(10, 'USD')).toBe(9505);
    expect(service.toClp(2, 'UF')).toBeCloseTo(79752.24);
    expect(JSON.parse(localStorage.getItem('exchange_rates')!)).toMatchObject({ USD: 950.5, source: 'auto' });
  });

  it('should not fetch again over values typed by the user unless forced', async () => {
    const fetch = mockFetch(RESPONSE);
    const service = TestBed.inject(ExchangeRateService);
    service.setManual({ USD: 1000, UF: null });

    await service.refresh();
    expect(fetch).not.toHaveBeenCalled();
    expect(service.rate('USD')).toBe(1000);
    expect(service.rate('UF')).toBeNull();

    await service.refresh(true);
    expect(service.rates()).toMatchObject({ USD: 950.5, source: 'auto' });
  });

  it('should keep the last values and explain when the fetch fails', async () => {
    mockFetch({}, false);
    const service = TestBed.inject(ExchangeRateService);
    service.setManual({ USD: 900, UF: 39000 });

    await service.refresh(true);

    expect(service.rate('USD')).toBe(900);
    expect(service.error()).toContain('a mano');
    expect(service.loading()).toBe(false);
  });
});
