const PREFIXES = [
  { exponent: 12, symbol: 'T' }, { exponent: 9, symbol: 'G' }, { exponent: 6, symbol: 'M' },
  { exponent: 3, symbol: 'k' }, { exponent: 0, symbol: '' }, { exponent: -3, symbol: 'm' },
  { exponent: -6, symbol: 'µ' }, { exponent: -9, symbol: 'n' }, { exponent: -12, symbol: 'p' },
] as const;

const INPUT_PREFIXES:Record<string,number>={t:1e12,g:1e9,meg:1e6,m:1e-3,k:1e3,u:1e-6,'µ':1e-6,n:1e-9,p:1e-12};

export function formatSI(value:number,unit='',significant=3) {
  if(!Number.isFinite(value))return `—${unit?` ${unit}`:''}`;
  if(value===0)return `0${unit?` ${unit}`:''}`;
  const absolute=Math.abs(value);
  const prefix=PREFIXES.find(item=>absolute>=10**item.exponent)||PREFIXES.at(-1)!;
  const scaled=value/10**prefix.exponent;
  const decimals=Math.max(0,significant-1-Math.floor(Math.log10(Math.abs(scaled))));
  const number=scaled.toFixed(Math.min(6,decimals)).replace(/\.0+$|(?<=\.[0-9]*?)0+$/,'');
  return `${number} ${prefix.symbol}${unit}`.trim();
}

/** Accepts engineering notation such as 15uF, 4.7 kΩ or 2M. */
export function parseSI(input:string):number|undefined {
  const normalized=input.trim().replace(',','.').replace(/\s+/g,'').replace(/[ΩΩVAWFHz]+$/i,'');
  const match=normalized.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)(meg|[tgmkµunp])?$/i);
  if(!match)return undefined;
  const multiplier=match[2]?INPUT_PREFIXES[match[2].toLowerCase()]??INPUT_PREFIXES[match[2]]:1;
  const value=Number(match[1])*multiplier;
  return Number.isFinite(value)?value:undefined;
}

export function unitForProperty(key:string) {
  const lower=key.toLowerCase();
  if(lower.includes('resistance')||lower==='impedance'||lower==='shunt'||lower.includes('transimpedance'))return 'Ω';
  if(lower.includes('capacitance'))return 'F';
  if(lower.includes('inductance'))return 'H';
  if(lower.includes('frequency')||lower.includes('bandwidth')||lower==='rbw'||lower==='vbw')return 'Hz';
  if(lower.includes('voltage')||lower==='supply'||lower==='threshold')return 'V';
  if(lower.includes('current'))return 'A';
  if(lower.includes('power'))return 'W';
  if(lower.includes('time')||lower.includes('period'))return 's';
  return '';
}

