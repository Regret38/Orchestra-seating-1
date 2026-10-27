import { describe, expect, it } from 'vitest';
import { computeCounts } from './counting';
import { indexCatalog, resolveItemLabel } from './labels';
import { addItem, changeItemKind, cloneLayoutData, createEmptyLayoutData, duplicateItem, makeItem, removeItem, updateItem } from './layoutOps';
import { findSpawnPosition } from './placement';
import { itemBounds } from './sets';
import { buildExportFile, parseImportFile, validateLayoutData } from './validation';
import { DemoRepository } from '../data/demoRepository';

const catalog = indexCatalog([]);

describe('수량에서 제외되는 기타 물체', () => {
  it('물체를 추가·복제·수정·삭제해도 기존 준비 수량과 예비 수량은 유지된다', () => {
    let d = createEmptyLayoutData();
    d = addItem(d, makeItem({ kind: 'stand_2chairs', instrumentId: null, partId: null }, 100, 100));
    d.spares = { stands: 2, chairs: 3, benches: 1 };
    const before = computeCounts(d.items, d.spares, catalog);
    const object = makeItem({ kind: 'object', instrumentId: null, partId: null, objectLabel: '피아노' }, 300, 300);
    d = addItem(d, object);
    d = duplicateItem(d, object.id).data;
    d = updateItem(d, object.id, { objectWidth: 350, objectHeight: 200, rotation: 90, objectLabel: '스피커 앞 공간' });
    let counts = computeCounts(d.items, d.spares, catalog);
    expect(counts.total).toEqual(before.total);
    expect(counts.byGroup).toEqual(before.byGroup);
    expect(counts.bySetKind.object).toBe(2);
    d = removeItem(d, object.id);
    counts = computeCounts(d.items, d.spares, catalog);
    expect(counts.total).toEqual(before.total);
    expect(counts.bySetKind.object).toBe(1);
  });

  it('물체만 놓으면 물품 수량과 악기별 표는 비어 있고 이름은 독립적으로 표시된다', () => {
    const item = makeItem({ kind: 'object', instrumentId: null, partId: null, objectLabel: '통로' }, 100, 100);
    const counts = computeCounts([item], createEmptyLayoutData().spares, catalog);
    expect(counts.total).toEqual({ stands: 0, chairs: 0, benches: 0, tallChairs: 0 });
    expect(counts.byGroup).toEqual([]);
    expect(resolveItemLabel(item, catalog).display).toBe('통로');
  });

  it('기존 세트를 물체로 바꾸면 집계에서 빠지고 다시 바꾸면 집계에 포함된다', () => {
    let d = createEmptyLayoutData();
    const item = makeItem({ kind: 'stand_2chairs', instrumentId: null, partId: null }, 100, 100);
    d = addItem(d, item);
    d = changeItemKind(d, item.id, 'object');
    expect(computeCounts(d.items, d.spares, catalog).placed).toEqual({ stands: 0, chairs: 0, benches: 0, tallChairs: 0 });
    expect(d.items[0]).toMatchObject({ objectWidth: 160, objectHeight: 100 });
    d = changeItemKind(d, item.id, 'bench');
    expect(computeCounts(d.items, d.spares, catalog).placed.benches).toBe(1);
    expect(d.items[0].objectWidth).toBeUndefined();
  });

  it('실제 표시 크기와 회전이 배치 영역·새 세트 생성 위치에 반영된다', () => {
    const item = { ...makeItem({ kind: 'object', instrumentId: null, partId: null }, 500, 500), objectWidth: 400, objectHeight: 200, rotation: 90 };
    expect(itemBounds(item).w).toBeCloseTo(200);
    expect(itemBounds(item).h).toBeCloseTo(400);
    const next = findSpawnPosition([item], 'chair_only', { x: 0, y: 0, w: 1000, h: 1000 }, { width: 1000, height: 1000 });
    expect(Math.abs(next.x - 500) > 100 || Math.abs(next.y - 500) > 200).toBe(true);
  });

  it('저장·JSON 복원·템플릿 복사에서 물체의 이름·크기·방향을 유지한다', async () => {
    let d = createEmptyLayoutData();
    d = addItem(d, { ...makeItem({ kind: 'object', instrumentId: null, partId: null, objectLabel: '그랜드 피아노' }, 500, 400, 45), objectWidth: 350, objectHeight: 220 });
    const repo = new DemoRepository(false); repo.latencyMs = 0;
    const stored = await repo.createLayout({ teamId: 'demo-team', kind: 'template', name: '물체 배치', eventDate: null, data: d });
    expect((await repo.getLayout(stored.id))?.data).toEqual(d);
    const parsed = parseImportFile(JSON.stringify(buildExportFile({ name: '물체 배치', kind: 'template', eventDate: null, data: d })));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw Error('round trip failed');
    expect(parsed.value.data).toEqual(d);
    const copy = cloneLayoutData(d); copy.items[0].objectWidth = 700;
    expect(d.items[0].objectWidth).toBe(350);
    expect(copy.items[0].id).not.toBe(d.items[0].id);
  });

  it('크기를 생략하면 기본값을 사용하고 잘못된 크기·이름은 가져오기를 거부한다', () => {
    const d = createEmptyLayoutData();
    const item = makeItem({ kind: 'object', instrumentId: null, partId: null }, 100, 100);
    delete item.objectWidth; delete item.objectHeight;
    d.items = [item];
    const result = validateLayoutData(d);
    expect(result.ok && result.value.items[0].objectWidth).toBe(160);
    for (const patch of [{ objectWidth: 0 }, { objectHeight: 1001 }, { objectWidth: NaN }, { objectLabel: 'x'.repeat(41) }]) {
      expect(validateLayoutData({ ...d, items: [{ ...item, ...patch }] }).ok).toBe(false);
    }
  });
});
