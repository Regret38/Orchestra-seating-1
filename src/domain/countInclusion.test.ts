import { describe, expect, it } from 'vitest';
import { computeCounts } from './counting';
import { buildDefaultInstruments } from './defaults';
import { indexCatalog } from './labels';
import { SET_KINDS } from './types';
import { SET_DEFINITIONS } from './sets';
import { changeItemKind, cloneLayoutData, createEmptyLayoutData, duplicateItem, flipStage, makeItem, setSpares, updateItem } from './layoutOps';
import { buildExportFile, parseImportFile, validateLayoutData } from './validation';
import { DemoRepository } from '../data/demoRepository';
import { useEditor } from '../state/editorStore';

const catalog = indexCatalog(buildDefaultInstruments());
const zero = { stands: 0, chairs: 0, benches: 0, tallChairs: 0 };

function layout() {
  const d = createEmptyLayoutData();
  d.items = SET_KINDS.filter(kind => kind !== 'object').map(kind => makeItem({ kind, instrumentId: 'demo-violin', partId: 'demo-vn1' }, 300, 300));
  return d;
}

describe('세트별 준비 수량 포함 여부', () => {
  it('기존 데이터와 새 세트는 기본 포함이며 모든 물품 종류를 집계한다', () => {
    const d = layout();
    expect(d.items.every(i => i.includeInCounts === undefined)).toBe(true);
    expect(computeCounts(d.items, d.spares, catalog).total).toEqual({ stands: 6, chairs: 4, benches: 1, tallChairs: 3 });
    const explicit = d.items.map(i => ({ ...i, includeInCounts: true }));
    expect(computeCounts(explicit, d.spares, catalog)).toEqual(computeCounts(d.items, d.spares, catalog));
  });
  it.each(SET_KINDS.filter(kind => kind !== 'object'))('%s를 제외하면 해당 구성만 빠지고 재포함하면 복원한다', kind => {
    const d = layout();
    const before = computeCounts(d.items, d.spares, catalog);
    const selected = d.items.find(i => i.kind === kind)!;
    const excluded = updateItem(d, selected.id, { includeInCounts: false });
    const after = computeCounts(excluded.items, excluded.spares, catalog);
    for (const key of ['stands', 'chairs', 'benches', 'tallChairs'] as const) {
      expect(after.placed[key]).toBe(before.placed[key] - SET_DEFINITIONS[kind].counts[key]);
      expect(after.byGroup[0][key]).toBe(before.byGroup[0][key] - SET_DEFINITIONS[kind].counts[key]);
    }
    expect(after.bySetKind).toEqual(before.bySetKind);
    expect(after.setCount).toBe(before.setCount);
    const restored = updateItem(excluded, selected.id, { includeInCounts: true });
    expect(computeCounts(restored.items, restored.spares, catalog)).toEqual(before);
  });
  it('전부 제외하면 악기별 준비 표에서 사라지지만 배치와 예비 수량은 남는다', () => {
    const d = setSpares(layout(), { stands: 2, chairs: 3, benches: 1, tallChairs: 4 });
    d.items = d.items.map(i => ({ ...i, includeInCounts: false }));
    const c = computeCounts(d.items, d.spares, catalog);
    expect(c.placed).toEqual(zero);
    expect(c.byGroup).toEqual([]);
    expect(c.total).toEqual({ stands: 2, chairs: 3, benches: 1, tallChairs: 4 });
    expect(c.setCount).toBe(8);
    expect(Object.values(c.bySetKind).reduce((a, b) => a + b, 0)).toBe(8);
  });
  it('기타 물체는 포함 속성과 관계없이 항상 준비 물품에서 제외한다', () => {
    const d = createEmptyLayoutData();
    const object = makeItem({ kind: 'object', instrumentId: null, partId: null }, 100, 100);
    for (const includeInCounts of [undefined, true, false]) {
      const c = computeCounts([{ ...object, includeInCounts }], d.spares, catalog);
      expect(c.total).toEqual(zero);
      expect(c.byGroup).toEqual([]);
      expect(c.bySetKind.object).toBe(1);
    }
  });
  it('이동·회전·구성 변경·복제·템플릿 복사에서도 제외 설정을 유지한다', () => {
    const d = layout();
    const item = d.items[0];
    let next = updateItem(d, item.id, { includeInCounts: false, x: 400, rotation: 33 });
    next = changeItemKind(next, item.id, 'tallchair_2stands');
    next = flipStage(next);
    const duplicated = duplicateItem(next, item.id);
    expect(duplicated.data.items.find(i => i.id === duplicated.newId)?.includeInCounts).toBe(false);
    const copied = cloneLayoutData(duplicated.data);
    expect(copied.items[0].includeInCounts).toBe(false);
    expect(copied.items.at(-1)?.includeInCounts).toBe(false);
    expect(copied.items[0].id).not.toBe(item.id);
  });
  it('저장·JSON 가져오기·실행 취소/다시 실행에서 설정을 보존한다', async () => {
    const d = layout();
    d.items[0].includeInCounts = false;
    d.items[1].includeInCounts = true;
    const exported = buildExportFile({ name: '수량 제외', kind: 'template', eventDate: null, data: d });
    const parsed = parseImportFile(JSON.stringify(exported));
    expect(parsed.ok && parsed.value.data).toEqual(d);
    const repo = new DemoRepository(false); repo.latencyMs = 0;
    const rec = await repo.createLayout({ teamId: 'demo-team', name: '수량 제외', kind: 'template', eventDate: null, data: d });
    expect((await repo.getLayout(rec.id))?.data).toEqual(d);
    const store = useEditor.getState;
    store().load(rec);
    store().commit(data => updateItem(data, d.items[0].id, { includeInCounts: true }));
    expect(store().data.items[0].includeInCounts).toBe(true);
    store().undo();
    expect(store().data.items[0].includeInCounts).toBe(false);
    store().redo();
    expect(store().data.items[0].includeInCounts).toBe(true);
    store().reset();
  });
  it.each(['false', 0, 1, null, {}, []])('잘못된 포함 여부 %j는 가져오기를 거부한다', value => {
    const d = layout();
    const result = validateLayoutData({ ...d, items: [{ ...d.items[0], includeInCounts: value }] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join()).toContain('includeInCounts');
  });
});
