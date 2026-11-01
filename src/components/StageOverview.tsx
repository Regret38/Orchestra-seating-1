import { useEffect, useMemo, useRef, useState } from 'react';
import { computeCounts } from '../domain/counting';
import type { CatalogIndex } from '../domain/labels';
import type { LayoutData } from '../domain/types';
import { StaticStage } from './stage/StaticStage';
import { Modal } from './ui';

/** View-only setup reference. Canvas size follows both viewport dimensions. */
export function StageOverview({ data, catalog, name, onClose }: {
  data: LayoutData; catalog: CatalogIndex; name: string; onClose(): void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const counts = useMemo(() => computeCounts(data.items, data.spares, catalog), [data, catalog]);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSize({ width: Math.max(1, Math.floor(el.clientWidth)), height: Math.max(1, Math.floor(el.clientHeight)) }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <Modal title={`무대 전체 보기 · ${name}`} onClose={onClose} fullscreen>
    <div ref={container} className="overview-stage" data-testid="overview-stage" aria-label="수정할 수 없는 무대 배치도">
      {size.width > 1 && size.height > 1 && <StaticStage data={data} catalog={catalog} width={size.width} height={size.height}/>}
    </div>
    <footer className="overview-footer">
      <div className="overview-caption"><span>최종 준비 수량 · 예비 포함</span><small>보기 전용 · 빨간 테두리는 수량 제외</small></div>
      <div className="overview-counts">{([['stands', '보면대'], ['chairs', '일반 의자'], ['benches', '장의자'], ['tallChairs', '키큰의자']] as const).map(([key, label]) => <div key={key}><span>{label}</span><strong data-testid={`overview-${key}`}>{counts.total[key]}<small>개</small></strong></div>)}</div>
    </footer>
  </Modal>;
}
