export interface TempSample {
  simTime: number;
  temp: number;
}

export interface ThermalHistoryData {
  airInt: TempSample[];
  wallInt: TempSample[];
  wallExt: TempSample[];
}

const DAY_SEC = 86400;

export class ThermalHistory {
  private airInt: TempSample[] = [];
  private wallInt: TempSample[] = [];
  private wallExt: TempSample[] = [];

  record(simTime: number, airInt: number, wallInt: number, wallExt: number) {
    this.push(this.airInt, simTime, airInt);
    this.push(this.wallInt, simTime, wallInt);
    this.push(this.wallExt, simTime, wallExt);
  }

  private push(series: TempSample[], simTime: number, temp: number) {
    const last = series[series.length - 1];
    if (last && Math.abs(last.simTime - simTime) < 0.5) {
      last.simTime = simTime;
      last.temp = temp;
      this.trim(series, simTime);
      return;
    }
    series.push({ simTime, temp });
    this.trim(series, simTime);
  }

  private trim(series: TempSample[], now: number) {
    const cutoff = now - DAY_SEC;
    while (series.length > 1 && series[0].simTime < cutoff) {
      series.shift();
    }
  }

  last24h(now: number): ThermalHistoryData {
    const cutoff = now - DAY_SEC;
    const filter = (s: TempSample[]) => s.filter((p) => p.simTime >= cutoff);
    return {
      airInt: filter(this.airInt),
      wallInt: filter(this.wallInt),
      wallExt: filter(this.wallExt),
    };
  }

  clear() {
    this.airInt = [];
    this.wallInt = [];
    this.wallExt = [];
  }
}

/** Moyenne T air int. + T paroi int. (confort ressenti). */
export function feltIntSeries(history: ThermalHistoryData): TempSample[] {
  return history.airInt.map((s, i) => {
    const wi = history.wallInt[i];
    const wallT = wi && Math.abs(wi.simTime - s.simTime) < 2 ? wi.temp : s.temp;
    return { simTime: s.simTime, temp: (s.temp + wallT) / 2 };
  });
}
