import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { computeCounts } from '../domain/counting';
import type { CatalogIndex } from '../domain/labels';
import type { LayoutData } from '../domain/types';
import type { View } from '../domain/viewport';
import { boundOverview, overviewPaper, zoomOverview, OVERVIEW_MAX_ZOOM } from '../domain/overviewView';
import { getStaticStageArea, StaticStage } from './stage/StaticStage';
import { Icon, Modal } from './ui';

type Point = { x: number; y: number };
type Gesture = { view: View; center: Point; distance: number };

/** A zoomable reference picture; gestures only change this popup's local view. */
export function StageOverview({ data, catalog, name, onClose }: {
  data: LayoutData; catalog: CatalogIndex; name: string; onClose(): void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const footer = useRef<HTMLElement>(null);
  const [size, setSize] = useState({ width: 320, height: 480 });
  const [footerHeight, setFooterHeight] = useState(48);
  const area = useMemo(() => getStaticStageArea(data, catalog), [data, catalog]);
  const paper = useMemo(() => overviewPaper(size, area.w / area.h, footerHeight), [size, area.w, area.h, footerHeight]);
  const imageHeight = Math.ceil(paper.width * area.h / area.w);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  const geometryRef = useRef({ paper, size });
  geometryRef.current = { paper, size };
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const counts = useMemo(() => computeCounts(data.items, data.spares, catalog), [data, catalog]);

  const updateView = (next: View) => { viewRef.current = next; setView(next); };
  const reset = () => {
    pointers.current.clear(); gesture.current = null;
    const { paper, size } = geometryRef.current;
    updateView(boundOverview({ scale: 1, x: 0, y: 0 }, paper, size));
  };
  useLayoutEffect(reset, [paper.width, paper.height, size.width, size.height]);

  useEffect(() => {
    const el = container.current, caption = footer.current;
    if (!el || !caption) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: Math.max(1, Math.floor(el.clientWidth)), height: Math.max(1, Math.floor(el.clientHeight)) });
      setFooterHeight(Math.ceil(caption.getBoundingClientRect().height / viewRef.current.scale));
    });
    observer.observe(el); observer.observe(caption);
    return () => observer.disconnect();
  }, []);

  const zoom = (factor: number, anchor?: Point) => {
    const { paper, size } = geometryRef.current;
    const center = anchor ?? { x: size.width / 2, y: size.height / 2 };
    updateView(zoomOverview(viewRef.current, center, center, factor, paper, size));
  };
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      zoom(Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002)), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  const point = (event: ReactPointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const beginGesture = () => {
    const points = [...pointers.current.values()];
    gesture.current = points.length >= 2
      ? { view: viewRef.current, center: { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }, distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) }
      : points.length === 1 ? { view: viewRef.current, center: points[0], distance: 0 } : null;
  };
  const endPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    beginGesture();
  };

  return <Modal title={`무대 전체 보기 · ${name}`} onClose={onClose} fullscreen>
    <div className="overview-tools" aria-label="전체 보기 확대 도구">
      <button aria-label="전체 보기 축소" disabled={view.scale <= 1} onClick={() => zoom(1 / 1.25)}><Icon name="zoomOut" size={17}/>축소</button>
      <span className="overview-zoom" role="status" aria-label="전체 보기 배율">{Math.round(view.scale * 100)}%</span>
      <button aria-label="전체 보기 확대" disabled={view.scale >= OVERVIEW_MAX_ZOOM} onClick={() => zoom(1.25)}><Icon name="zoomIn" size={17}/>확대</button>
      <button onClick={reset} aria-label="전체 보기 화면 맞춤"><Icon name="fit" size={17}/>맞춤</button>
      <small>보기 전용 · 확대 후 끌어 이동 · 두 손가락으로 확대·축소</small>
    </div>
    <div ref={container} className="overview-stage" data-testid="overview-stage" aria-label="확대하거나 이동해서 보는 무대 배치도"
      onPointerDown={event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        event.preventDefault();
        pointers.current.set(event.pointerId, point(event));
        event.currentTarget.setPointerCapture(event.pointerId);
        beginGesture();
      }}
      onPointerMove={event => {
        if (!pointers.current.has(event.pointerId)) return;
        event.preventDefault();
        pointers.current.set(event.pointerId, point(event));
        const current = gesture.current, points = [...pointers.current.values()];
        if (!current) return;
        const { paper, size } = geometryRef.current;
        if (points.length >= 2 && current.distance > 0) {
          const center = { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
          const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          updateView(zoomOverview(current.view, current.center, center, distance / current.distance, paper, size));
        } else if (points.length === 1) {
          updateView(boundOverview({ ...current.view, x: current.view.x + points[0].x - current.center.x, y: current.view.y + points[0].y - current.center.y }, paper, size));
        }
      }}
      onPointerUp={endPointer} onPointerCancel={endPointer}
      onLostPointerCapture={event => { if (pointers.current.delete(event.pointerId)) beginGesture(); }}
      onDoubleClick={reset}
    >
      <div className="overview-paper" style={{ width: paper.width, transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        <StaticStage data={data} catalog={catalog} width={paper.width} height={imageHeight} resolutionScale={view.scale}/>
        <footer ref={footer} className="overview-footer">
          <div className="overview-caption">최종 준비 수량 · 예비 포함</div>
          <div className="overview-counts">{([['stands', '보면대'], ['chairs', '일반 의자'], ['benches', '장의자'], ['tallChairs', '키큰의자']] as const).map(([key, label]) => <div key={key}><span>{label}</span><strong data-testid={`overview-${key}`}>{counts.total[key]}<small>개</small></strong></div>)}</div>
        </footer>
      </div>
    </div>
  </Modal>;
}
