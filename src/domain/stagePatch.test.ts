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
    expect(flipped.items[0]).toMatchObject({ x: 1300, y: 800, rotation: 210, labelOffset: { x: -40, y: 75 } });
    expect(podiumPoint(flipped.stage).y).toBe(d.stage.height - podiumPoint(d.stage).y);
    expect(computeCounts(flipped.items, flipped.spares, catalog).total).toEqual(computeCounts(d.items, d.spares, catalog).total);
    expect(flipStage(flipped)).toEqual(d);
  });
  it('비대칭 배치의 상대 거리·방향·좌우 순서를 180도 회전으로 보존한다', () => {
    const d = createEmptyLayoutData();
    d.stage = { width: 1800, height: 900 };
    d.items = [[250, 180, 17], [1320, 360, 289], [710, 630, 90]].map(([x, y, rotation]) => makeItem({ kind: 'stand_2chairs', instrumentId: null, partId: null }, x, y, rotation));
    const next = flipStage(d);
    for (let i = 0; i < d.items.length; i++) {
      const a = d.items[i], b = next.items[i];
      expect(b.x).toBe(d.stage.width - a.x);
      expect(b.y).toBe(d.stage.height - a.y);
      const heading = (rotation: number) => ({ x: -Math.sin(rotation * Math.PI / 180), y: Math.cos(rotation * Math.PI / 180) });
      expect(heading(b.rotation).x).toBeCloseTo(-heading(a.rotation).x);
      expect(heading(b.rotation).y).toBeCloseTo(-heading(a.rotation).y);
      const j = (i + 1) % d.items.length;
      expect(Math.hypot(b.x - next.items[j].x, b.y - next.items[j].y)).toBeCloseTo(Math.hypot(a.x - d.items[j].x, a.y - d.items[j].y));
    }
    const area = (items: typeof d.items) => (items[1].x - items[0].x) * (items[2].y - items[0].y) - (items[1].y - items[0].y) * (items[2].x - items[0].x);
    expect(area(next.items)).toBe(area(d.items)); // A mirror would reverse the sign.
    expect(flipStage(next)).toEqual(d);
  });
  it('이름표의 위아래와 좌우 프리셋도 180도 회전하고 두 번 누르면 돌아온다', () => {
    const d = createEmptyLayoutData();
    d.items = (['top', 'bottom', 'left', 'right', 'center'] as const).map(labelPosition => ({ ...makeItem({ kind: 'chair_only', instrumentId: null, partId: null }, 250, 200, 30), labelPosition }));
    const next = flipStage(d);
    expect(next.items.map(i => i.labelPosition)).toEqual(['bottom', 'top', 'right', 'left', 'center']);
    expect(flipStage(next)).toEqual(d);
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

describe('장의자·키큰의자 세트와 모든 악기 번호', () => {
  it('기존 장의자와 키큰의자 3종은 각각 별도로 집계된다', () => {
    const kinds = ['bench', 'tallchair_only', 'tallchair_1stand', 'tallchair_2stands'] as const;
    const items = kinds.map(kind => makeItem({ kind, instrumentId: null, partId: null }, 100, 100));
    const d = createEmptyLayoutData(); d.items = items;
    const counts = computeCounts(items, d.spares, catalog);
    expect(counts.total).toEqual({ stands: 3, chairs: 0, benches: 1, tallChairs: 3 });
    expect(counts.byGroup[0].tallChairs).toBe(3);
    for (const kind of kinds.slice(1)) {
      const geometry = getSetGeometry(kind);
      expect(geometry.tallChair).toBeDefined();
      expect(geometry.bench).toBeNull();
      expect(geometry.chairs).toHaveLength(0);
    }
    expect(getSetGeometry('tallchair_2stands').stands).toHaveLength(2);
    const next = updateItem(d, items[0].id, { benchLength: 1200 });
    expect(next.items[0].benchLength).toBe(1200);
    const changed = changeItemKind(next, items[0].id, 'tallchair_only');
    expect(changed.items[0].benchLength).toBeUndefined();
    expect(BENCH_MAX_LENGTH).toBe(1200);
    expect(validateLayoutData(next).ok).toBe(true);
    expect(validateLayoutData({ ...next, items: [{ ...next.items[0], benchLength: 1201 }] }).ok).toBe(false);
  });
  it('이전 두 장의자 조합을 키큰의자로 읽고 단독 장의자는 유지한다', () => {
    const d = createEmptyLayoutData();
    const base = makeItem({ kind: 'bench', instrumentId: null, partId: null }, 300, 200, 37);
    const original = ['bench', 'bench_1stand', 'bench_2stands'].map((kind, i) => ({ ...base, id: `old-${i}`, kind, benchLength: 1200, labelPosition: 'custom', labelOffset: { x: 45, y: -55 } }));
    const result = validateLayoutData({ ...d, items: original });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map(i => i.kind)).toEqual(['bench', 'tallchair_1stand', 'tallchair_2stands']);
    expect(result.value.items[0].benchLength).toBe(1200);
    for (const i of result.value.items.slice(1)) {
      expect(i.benchLength).toBeUndefined();
      expect(i).toMatchObject({ x: 300, y: 200, rotation: 37, labelOffset: { x: 45, y: -55 } });
    }
    expect(validateLayoutData(result.value)).toEqual(result);
  });
  it('키큰의자 예비 수량은 별도로 저장·집계하고 기존 파일은 0으로 처리한다', () => {
    const d = createEmptyLayoutData();
    const parsed = validateLayoutData({ ...d, spares: { ...d.spares, tallChairs: 4 } });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(computeCounts([], parsed.value.spares, catalog).total.tallChairs).toBe(4);
    expect(computeCounts([], d.spares, catalog).total.tallChairs).toBe(0);
    expect(validateLayoutData({ ...d, spares: { ...d.spares, tallChairs: -1 } }).ok).toBe(false);
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
    d.items = [{ ...makeItem({ kind: 'bench', instrumentId: 'demo-cello', partId: numberedPartId('demo-cello', 5) }, 400, 300), benchLength: 1200, labelPosition: 'custom', labelOffset: { x: 70, y: -100 } }];
    d = flipStage(d);
    const parsed = parseImportFile(JSON.stringify(buildExportFile({ name: '패치 검증', kind: 'template', eventDate: null, data: d })));
    expect(parsed.ok && parsed.value.data).toEqual(d);
    const repo = new DemoRepository(false); repo.latencyMs = 0;
    const rec = await repo.createLayout({ teamId: 'demo-team', kind: 'template', name: '패치 검증', eventDate: null, data: d });
    expect((await repo.getLayout(rec.id))?.data).toEqual(d);
    expect(resolveItemLabel(d.items[0], catalog).display).toBe('첼로 5');
  });
});
