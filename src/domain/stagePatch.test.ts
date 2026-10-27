import { describe, it, expect } from 'vitest';
import { buildDefaultInstruments } from './defaults';
import { withNumberedParts, numberedPartName, numberedPartId } from './numberedParts';
import { indexCatalog, resolveItemLabel } from './labels';
import { addItem, createEmptyLayoutData, flipStage, makeItem, podiumPoint, updateItem, changeItemKind } from './layoutOps';
import { labelCenter, visualBounds } from './labelPlacement';
import { getSetGeometry, BENCH_MAX_LENGTH } from './sets';
import { computeCounts } from './counting';
import { validateLayoutData, buildExportFile, parseImportFile } from './validation';
import { DemoRepository } from '../data/demoRepository';

const catalog = indexCatalog(buildDefaultInstruments());

describe('무대 반전과 이름표', () => {
  it('앞뒤 반전은 위치·방향·지휘대를 함께 바꾸고 두 번 누르면 원래로 돌아온다', () => {
    let d = createEmptyLayoutData();
    d = addItem(d, { ...makeItem({ kind: 'stand_2chairs', instrumentId: null, partId: null }, 300, 200, 30), labelPosition: 'custom', labelOffset: { x: 40, y: -75 } });
    const flipped = flipStage(d);
    expect(flipped.stage.frontAtTop).toBe(true);
    expect(flipped.items[0]).toMatchObject({ x: 300, y: 800, rotation: 150, labelOffset: { x: 40, y: 75 } });
    expect(podiumPoint(flipped.stage).y).toBe(d.stage.height - podiumPoint(d.stage).y);
    expect(computeCounts(flipped.items, flipped.spares, catalog).total).toEqual(computeCounts(d.items, d.spares, catalog).total);
    expect(flipStage(flipped)).toEqual(d);
  });
  it('이름표 프리셋은 회전한 세트 바깥의 위·아래·좌·우와 가운데에 놓인다', () => {
    const item = makeItem({ kind: 'bench', instrumentId: null, partId: null }, 500, 500, 90);
    expect(labelCenter({ ...item, labelPosition: 'top' }, 120, 30).y).toBeLessThan(-75);
    expect(labelCenter({ ...item, labelPosition: 'bottom' }, 120, 30).y).toBeGreaterThan(75);
    expect(labelCenter({ ...item, labelPosition: 'left' }, 120, 30).x).toBeLessThan(-60);
    expect(labelCenter({ ...item, labelPosition: 'right' }, 120, 30).x).toBeGreaterThan(60);
    expect(labelCenter(item, 120, 30)).toEqual({ x: 0, y: 0 });
  });
  it('이름표를 멀리 옮겨도 본체 좌표는 유지되고 출력·화면 영역에 이름표가 포함된다', () => {
    const item = { ...makeItem({ kind: 'chair_only', instrumentId: null, partId: null }, 100, 100), labelPosition: 'custom' as const, labelOffset: { x: 700, y: -200 } };
    const bounds = visualBounds(item, 120, 30);
    expect(bounds.x + bounds.w).toBeGreaterThanOrEqual(860);
    expect(bounds.y).toBeLessThanOrEqual(-115);
    expect(item.x).toBe(100);
  });
  it('기존 데이터는 가운데 이름표·아래쪽 무대로 읽고 잘못된 새 필드는 거부한다', () => {
    const d = createEmptyLayoutData(); d.items = [makeItem({ kind: 'chair_only', instrumentId: null, partId: null }, 100, 100)];
    expect(validateLayoutData(d).ok).toBe(true);
    expect(validateLayoutData({ ...d, stage: { ...d.stage, frontAtTop: 'yes' } }).ok).toBe(false);
    for (const patch of [{ labelPosition: 'unknown' }, { labelOffset: { x: NaN, y: 0 } }, { labelOffset: { x: 4001, y: 0 } }]) expect(validateLayoutData({ ...d, items: [{ ...d.items[0], ...patch }] }).ok).toBe(false);
  });
});

describe('장의자 세트와 모든 악기 번호', () => {
  it('새 장의자 세트의 보면대와 장의자 수를 정확하게 계산한다', () => {
    const items = ['bench', 'bench_1stand', 'bench_2stands'].map(k => makeItem({ kind: k as 'bench', instrumentId: null, partId: null }, 100, 100));
    expect(computeCounts(items, createEmptyLayoutData().spares, catalog).total).toEqual({ stands: 3, chairs: 0, benches: 3 });
    expect(getSetGeometry('bench_2stands', 1200).stands.map(s => s.x)).toEqual([-326, 274]);
    let d = createEmptyLayoutData(); d.items = [items[1]];
    d = updateItem(d, items[1].id, { benchLength: 1200 });
    expect(d.items[0].benchLength).toBe(1200);
    d = changeItemKind(d, items[1].id, 'bench_2stands');
    expect(d.items[0].benchLength).toBe(1200);
    expect(BENCH_MAX_LENGTH).toBe(1200);
    expect(validateLayoutData(d).ok).toBe(true);
    expect(validateLayoutData({ ...d, items: [{ ...d.items[0], benchLength: 1201 }] }).ok).toBe(false);
  });
  it('기본·새로 추가·직접 입력 악기 모두 1~5 파트를 제공하고 기존 ID를 보존한다', () => {
    const original = buildDefaultInstruments();
    const instruments = withNumberedParts([...original, { ...original[0], id: 'new-harp', name: '하프', parts: [] }]);
    for (const inst of instruments) for (let n = 1; n <= 5; n++) expect(inst.parts.some(p => p.name === numberedPartName(inst.name, n))).toBe(true);
    expect(instruments[0].parts.find(p => p.name === '제1바이올린')?.id).toBe('demo-vn1');
    expect(withNumberedParts(instruments)).toEqual(instruments);
    const custom = makeItem({ kind: 'stand_only', instrumentId: 'demo-other', partId: numberedPartId('demo-other', 5), customLabel: '하프' }, 0, 0);
    expect(resolveItemLabel(custom, catalog).display).toBe('하프 5');
  });
  it('방향·이름표·1200 장의자·5파트가 저장과 JSON 왕복에서 보존된다', async () => {
    let d = createEmptyLayoutData();
    d.items = [{ ...makeItem({ kind: 'bench_2stands', instrumentId: 'demo-cello', partId: numberedPartId('demo-cello', 5) }, 400, 300), benchLength: 1200, labelPosition: 'custom', labelOffset: { x: 70, y: -100 } }];
    d = flipStage(d);
    const parsed = parseImportFile(JSON.stringify(buildExportFile({ name: '패치 검증', kind: 'template', eventDate: null, data: d })));
    expect(parsed.ok && parsed.value.data).toEqual(d);
    const repo = new DemoRepository(false); repo.latencyMs = 0;
    const rec = await repo.createLayout({ teamId: 'demo-team', kind: 'template', name: '패치 검증', eventDate: null, data: d });
    expect((await repo.getLayout(rec.id))?.data).toEqual(d);
    expect(resolveItemLabel(d.items[0], catalog).display).toBe('첼로 5');
  });
});
