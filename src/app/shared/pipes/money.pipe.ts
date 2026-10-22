import { Pipe, PipeTransform } from '@angular/core';
import { BASE_CURRENCY, Currency, formatMoney } from '../../core/models/currency.model';

/** `amount | money` in pesos, or `amount | money:'USD'` in another currency. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(amount: number, currency: Currency = BASE_CURRENCY): string {
    return formatMoney(amount, currency);
  }
}
