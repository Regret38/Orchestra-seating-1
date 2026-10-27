import { itemBounds, type Rect } from './sets';
import type { StageItem } from './types';

export const LABEL_OFFSET_LIMIT = 4000;
export const LABEL_POSITIONS = ['top', 'bottom', 'left', 'right', 'center'] as const;
export const LABEL_POSITION_NAMES = { top: '위쪽', bottom: '아래쪽', left: '왼쪽', right: '오른쪽', center: '가운데' } as const;

/** 이름표는 화면 방향을 기준으로 놓고 세트 회전 뒤에도 똑바로 읽는다. */
export function labelCenter(item: StageItem, width: number, height: number, gap = 10) {
  if (item.labelPosition === 'custom' && item.labelOffset) return item.labelOffset;
  const bounds = itemBounds(item);
  switch (item.labelPosition) {
    case 'top': return { x: 0, y: -bounds.h / 2 - height / 2 - gap };
    case 'bottom': return { x: 0, y: bounds.h / 2 + height / 2 + gap };
    case 'left': return { x: -bounds.w / 2 - width / 2 - gap, y: 0 };
    case 'right': return { x: bounds.w / 2 + width / 2 + gap, y: 0 };
    default: return { x: 0, y: 0 };
  }
}

/** 멀리 옮긴 이름표도 화면 맞추기와 출력 영역에 포함한다. */
export function visualBounds(item: StageItem, width = 180, height = 30): Rect {
  const body = itemBounds(item), label = labelCenter(item, width, height);
  const x = Math.min(body.x, item.x + label.x - width / 2);
  const y = Math.min(body.y, item.y + label.y - height / 2);
  return { x, y, w: Math.max(body.x + body.w, item.x + label.x + width / 2) - x, h: Math.max(body.y + body.h, item.y + label.y + height / 2) - y };
}
