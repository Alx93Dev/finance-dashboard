import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StorageService {
  get<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }

  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }
}
