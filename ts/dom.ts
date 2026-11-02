import { S } from './state';

export function query<T extends Element = HTMLElement>(selector: string): T | null {
  return (S.shadow?.querySelector(selector) as T | null) ?? null;
}

export function queryAll(selector: string): Element[] {
  return S.shadow ? [...S.shadow.querySelectorAll(selector)] : [];
}

// document listeners see the shadow host as the target
export function realTarget(e: Event): EventTarget | null {
  return e.composedPath()[0] ?? e.target;
}
