import type { CountSummary } from '../../domain/counting';
import type Konva from 'konva';
import { STAGE_FONT } from './SetNode';

export const COUNT_FOOTER_HEIGHT = 146;
const materials = [
  ['stands', '보면대'], ['chairs', '일반 의자'], ['benches', '장의자'], ['tallChairs', '키큰의자'],
] as const;

/** Compose the footer into actual PNG pixels, independent of the surrounding DOM. */
export function stageImage(stage: Konva.Stage, counts: CountSummary, pixelRatio = 2, includeCounts = true): string {
  if (!includeCounts) return stage.toDataURL({ pixelRatio, mimeType: 'image/png' });
  const source = stage.toCanvas({ pixelRatio });
  const canvas = document.createElement('canvas');
  const width = stage.width(), height = stage.height();
  canvas.width = source.width;
  canvas.height = Math.ceil((height + COUNT_FOOTER_HEIGHT) * pixelRatio);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 만들 수 없습니다. 다시 시도해 주세요.');
  ctx.scale(pixelRatio, pixelRatio);
  ctx.drawImage(source, 0, 0, width, height);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, height, width, COUNT_FOOTER_HEIGHT);
  ctx.fillStyle = '#d9e2d8'; ctx.fillRect(18, height + 2, width - 36, 1);
  ctx.textBaseline = 'top'; ctx.fillStyle = '#173e36';
  ctx.font = `bold 17px ${STAGE_FONT}`;
  ctx.fillText('최종 준비 수량 · 예비 포함', 24, height + 15);
  const cellWidth = (width - 48) / 4;
  materials.forEach(([key, label], i) => {
    const x = 24 + i * cellWidth;
    ctx.fillStyle = '#eef2e9'; ctx.fillRect(x, height + 44, cellWidth - 8, 62);
    ctx.fillStyle = '#53685b'; ctx.font = `14px ${STAGE_FONT}`;
    ctx.fillText(label, x + 12, height + 52);
    ctx.fillStyle = '#173e36'; ctx.font = `bold 25px ${STAGE_FONT}`;
    ctx.fillText(`${counts.total[key]}개`, x + 12, height + 73);
  });
  ctx.fillStyle = '#64748b'; ctx.font = `12px ${STAGE_FONT}`;
  ctx.fillText('빨간 테두리: 준비 수량 제외 · 배치 안내도 (실제 축척 아님)', 24, height + 119);
  return canvas.toDataURL('image/png');
}
