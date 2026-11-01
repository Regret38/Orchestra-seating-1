import { describe, expect, it } from 'vitest';
import { boundOverview, overviewPaper, zoomOverview, overviewZoom } from './overviewView';

describe('보기 전용 팝업의 확대와 사진 하단 수량 배치', () => {
  it.each([{ width: 412, height: 680 }, { width: 915, height: 310 }, { width: 1440, height: 850 }])('사진과 수량을 함께 가용 공간에 맞춘다: %j', viewport => {
    const paper = overviewPaper(viewport, 1.4, 46);
    expect(paper.width).toBeLessThanOrEqual(viewport.width - 15);
    expect(paper.height).toBeLessThanOrEqual(viewport.height - 15);
    expect((paper.height - 46) / paper.width).toBeCloseTo(1 / 1.4, 2);
    const fit = boundOverview({ scale: 1, x: 999, y: -999 }, paper, viewport);
    expect(fit.x).toBeCloseTo((viewport.width - paper.width) / 2);
    expect(fit.y).toBeCloseTo((viewport.height - paper.height) / 2);
  });
  it('확대 중심의 사진 좌표를 고정하고 손가락 중심 이동을 반영한다', () => {
    const paper = { width: 400, height: 400 }, viewport = { width: 400, height: 400 };
    const v = { scale: 2, x: -200, y: -200 }, from = { x: 170, y: 180 }, to = { x: 190, y: 210 };
    const next = zoomOverview(v, from, to, 1.5, paper, viewport);
    expect(next.scale).toBe(3);
    expect((to.x - next.x) / next.scale).toBeCloseTo((from.x - v.x) / v.scale);
    expect((to.y - next.y) / next.scale).toBeCloseTo((from.y - v.y) / v.scale);
  });
  it('과도하게 끌어도 확대된 사진의 빈 바깥으로 사라지지 않는다', () => {
    const paper = { width: 400, height: 300 }, viewport = { width: 400, height: 500 };
    const first = boundOverview({ scale: 3, x: 900, y: -5000 }, paper, viewport);
    expect(first).toEqual({ scale: 3, x: 0, y: -400 });
    expect(boundOverview({ scale: 3, x: -9000, y: 5000 }, paper, viewport)).toEqual({ scale: 3, x: -800, y: 0 });
  });
  it('사진이 작은 축은 중앙에 두고 확대 한도를 100~600%로 제한한다', () => {
    expect(boundOverview({ scale: 2, x: 100, y: 100 }, { width: 200, height: 100 }, { width: 400, height: 500 })).toEqual({ scale: 2, x: 0, y: 150 });
    expect(overviewZoom(0.2)).toBe(1);
    expect(overviewZoom(99)).toBe(6);
    expect(overviewZoom(NaN)).toBe(1);
  });
});
