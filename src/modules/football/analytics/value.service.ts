import { Injectable } from '@nestjs/common';
import { CdfPoint } from './distribution.service';

export interface ValueResult {
  threshold: number;
  odd: number;
  pUnder: number;
  impliedProb: number;
  edge: number;
  ev: number;
}

/** Valor esperado (EV) de uma aposta "menos de N" contra uma odd informada. */
@Injectable()
export class ValueService {
  compute(cdf: CdfPoint[], threshold: number, odd: number): ValueResult | null {
    const point = cdf.find((p) => p.value === threshold);
    if (!point || odd <= 1) return null;
    const p = point.pUnder;
    const impliedProb = 1 / odd;
    return {
      threshold,
      odd,
      pUnder: p,
      impliedProb: this.round(impliedProb),
      edge: this.round(p - impliedProb),
      ev: this.round(p * odd - 1),
    };
  }

  private round(v: number): number {
    return Math.round(v * 1000) / 1000;
  }
}
