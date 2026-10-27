import type { Instrument } from './types';

export function numberedPartName(name: string, n: number) { return name === '바이올린' ? `제${n}바이올린` : `${name} ${n}`; }
export function numberedPartId(id: string, n: number) { return `numbered:${id}:${n}`; }

/** 기존 파트 ID·이름은 보존하고 부족한 1~5 파트만 안정적인 ID로 보충한다.
 * 파트 참조는 기존 layouts.data JSON에 저장되므로 DB 변경이나 마이그레이션이 필요 없다.
 */
export function withNumberedParts(instruments: Instrument[]): Instrument[] {
  return instruments.map(inst => {
    const parts = [...inst.parts];
    for (let n = 1; n <= 5; n++) {
      const name = numberedPartName(inst.name, n);
      if (!parts.some(p => p.name === name)) parts.push({ id: numberedPartId(inst.id, n), instrumentId: inst.id, name, color: null, sortOrder: n, isActive: true, generated: true });
    }
    return { ...inst, parts: parts.sort((a, b) => a.sortOrder - b.sortOrder) };
  });
}
