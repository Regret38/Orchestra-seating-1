import type { Size, View } from './viewport';

export const OVERVIEW_MAX_ZOOM = 6;
export const overviewZoom = (scale: number) => Math.max(1, Math.min(OVERVIEW_MAX_ZOOM, Number.isFinite(scale) ? scale : 1));

/** Keep the full stage and its attached compact caption inside the initial view. */
export function overviewPaper(viewport: Size, aspectRatio: number, footerHeight: number): Size {
  const width = Math.max(1, Math.min(viewport.width - 16, Math.max(1, viewport.height - footerHeight - 16) * aspectRatio));
  return { width, height: Math.ceil(width / aspectRatio) + footerHeight };
}

/** Empty margins stay centered. Zoomed edges cannot be dragged entirely offscreen. */
export function boundOverview(view: View, paper: Size, viewport: Size): View {
  const scale = overviewZoom(view.scale);
  const bound = (offset: number, length: number, available: number) => length <= available ? (available - length) / 2 : Math.max(available - length, Math.min(0, offset));
  return { scale, x: bound(view.x, paper.width * scale, viewport.width), y: bound(view.y, paper.height * scale, viewport.height) };
}

export function zoomOverview(view: View, from: { x: number; y: number }, to: { x: number; y: number }, factor: number, paper: Size, viewport: Size): View {
  const scale = overviewZoom(view.scale * factor);
  return boundOverview({ scale, x: to.x - (from.x - view.x) / view.scale * scale, y: to.y - (from.y - view.y) / view.scale * scale }, paper, viewport);
}
