import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function blank(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('(예시)');
  await page.getByRole('button', { name: '배치 목록', exact: true }).click();
  await page.getByLabel('새 배치 이름').fill('현장 세팅 보기');
  await page.getByRole('button', { name: '빈 무대로 만들기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
async function exportJSON(page: Page) {
  await page.getByRole('button', { name: '출력·내보내기' }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON 내보내기', exact: true }).click();
  const file = await event;
  const result = JSON.parse(await readFile((await file.path())!, 'utf8'));
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  return result.layout.data;
}
async function sample(page: Page) {
  await blank(page);
  await page.locator('.add-fields').getByLabel('악기', { exact: true }).selectOption({ label: '바이올린' });
  await page.getByRole('button', { name: '무대에 추가', exact: true }).click();
  await page.getByRole('button', { name: '키큰의자+보면대2', exact: true }).click();
  await page.getByRole('button', { name: '무대에 추가', exact: true }).click();
  await page.getByRole('checkbox', { name: '준비 수량에 포함', exact: true }).uncheck();
  await page.getByRole('button', { name: '준비 수량', exact: true }).click();
  for (const [name, number] of [['보면대', '5'], ['의자', '1'], ['장의자', '2'], ['키큰의자', '4']]) await page.getByLabel(`예비 ${name}`, { exact: true }).fill(number);
}

// Pixel snapshots verify the rendered viewport, without accessing editor internals.
async function floor(page: Page) {
  return page.getByTestId('stage').locator('canvas').first().evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
}

test('모바일 빈 무대 한 손가락은 페이지 스크롤, 두 손가락은 무대 이동·확대', async ({ page, isMobile }) => {
  test.skip(!isMobile, '터치 동작은 모바일 프로젝트에서 검사');
  await blank(page);
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  const box = (await page.getByTestId('stage').boundingBox())!;
  const startScroll = await page.evaluate(() => scrollY);
  const before = await floor(page);
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width * 0.35, y = box.y + box.height * 0.7;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  for (let n = 1; n <= 12; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - n * 10, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(startScroll + 30);
  expect(await floor(page)).toBe(before);
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const rect = (await page.getByTestId('stage').boundingBox())!;
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
  const scrollBeforePair = await page.evaluate(() => scrollY);
  const points = (dx: number, dy: number, spread = 40) => [{ x: cx - spread + dx, y: cy + dy, id: 1 }, { x: cx + spread + dx, y: cy + dy, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0, 0) });
  for (let n = 1; n <= 8; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(n * 6, n * 4) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => floor(page)).not.toBe(before);
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(scrollBeforePair, 0);
  const panned = await floor(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0, 0) });
  for (let n = 1; n <= 8; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(0, 0, 40 + n * 6) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => floor(page)).not.toBe(panned);
  expect(await page.evaluate(() => visualViewport!.scale)).toBeCloseTo(1, 1);
  await cdp.detach();
});

test('선택한 세트 위의 두 손가락 제스처도 배치 데이터를 변경하지 않는다', async ({ page, isMobile }) => {
  test.skip(!isMobile, '터치 동작은 모바일 프로젝트에서 검사');
  await blank(page);
  await page.getByRole('button', { name: '무대에 추가', exact: true }).click();
  const before = await exportJSON(page);
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  const rect = (await page.getByTestId('stage').boundingBox())!;
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const points = (dx: number) => [{ x: x + dx, y, id: 1 }, { x: x + 60 + dx, y: y + 5, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(0) });
  for (let n = 1; n <= 8; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(n * 5) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  expect(await exportJSON(page)).toEqual(before);
});

test('표 하단 배치 합계·예비·최종 합계와 PNG 안의 수량 푸터', async ({ page }) => {
  await sample(page);
  const table = page.getByRole('complementary').locator('.group-table');
  await expect(table.locator('tfoot tr').nth(0)).toHaveText('배치 합계1200');
  await expect(table.locator('tfoot tr').nth(1)).toHaveText('예비 물품5124');
  await expect(table.locator('tfoot tr').nth(2)).toHaveText('최종 준비 수량6324');
  await page.getByRole('button', { name: '출력·내보내기' }).click();
  const stageSize = await page.locator('.output-preview canvas').evaluate((c: HTMLCanvasElement) => ({ width: c.width, height: c.height }));
  await page.evaluate(() => {
    const original = CanvasRenderingContext2D.prototype.fillText;
    (window as unknown as { exportTexts: string[] }).exportTexts = [];
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args: [number, number, number?]) {
      (window as unknown as { exportTexts: string[] }).exportTexts.push(text);
      return original.call(this, text, args[0], args[1], args[2]);
    };
  });
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNG 이미지', exact: true }).click();
  const png = await readFile((await (await event).path())!);
  const info = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
    const pixel = [...ctx.getImageData(70, image.height - 150, 1, 1).data];
    return { width: image.width, height: image.height, pixel, texts: (window as unknown as { exportTexts: string[] }).exportTexts };
  }, png.toString('base64'));
  expect(info.width).toBe(1800);
  expect(info.height).toBeGreaterThan(stageSize.height / (await page.evaluate(() => devicePixelRatio)) * 2 + 280);
  expect(info.pixel.slice(0, 3)).toEqual([238, 242, 233]);
  for (const text of ['최종 준비 수량 · 예비 포함', '보면대', '일반 의자', '장의자', '키큰의자', '6개', '3개', '2개', '4개']) expect(info.texts).toContain(text);
  await page.evaluate(() => { (window as unknown as { didPrint?: boolean }).didPrint = false; window.print = () => { (window as unknown as { didPrint?: boolean }).didPrint = true; }; });
  await page.getByRole('button', { name: '인쇄 / PDF 저장', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { didPrint?: boolean }).didPrint)).toBe(true);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-sheet')).toBeVisible();
  await expect(page.locator('.print-sheet').getByTestId('total-stands')).toHaveText('6개');
  await expect(page.locator('.print-sheet').getByTestId('total-tallChairs')).toHaveText('4개');
  await expect(page.locator('.print-sheet .group-table tfoot tr').last()).toHaveText('최종 준비 수량6324');
});

test('전체 보기 팝업은 보기 전용·화면 맞춤·회전 반응·닫기 후 원본 유지', async ({ page, isMobile }) => {
  await sample(page);
  const before = await exportJSON(page);
  await page.getByRole('button', { name: '전체 보기', exact: true }).click();
  const modal = page.getByRole('dialog', { name: /^무대 전체 보기/ });
  await expect(modal).toBeVisible();
  await expect(modal.getByTestId('overview-stands')).toHaveText('6개');
  await expect(modal.getByTestId('overview-chairs')).toHaveText('3개');
  await expect(modal.getByTestId('overview-benches')).toHaveText('2개');
  await expect(modal.getByTestId('overview-tallChairs')).toHaveText('4개');
  await expect(modal.locator('input,select')).toHaveCount(0);
  const checkFit = async () => {
    await expect.poll(async () => {
      const bounds = await modal.boundingBox();
      const viewport = page.viewportSize()!;
      return !!bounds && Math.abs(bounds.width - viewport.width) < 2 && Math.abs(bounds.height - viewport.height) < 2;
    }).toBe(true);
    const host = (await page.getByTestId('overview-stage').boundingBox())!;
    const canvas = (await page.getByTestId('overview-stage').locator('canvas').boundingBox())!;
    expect(canvas.width).toBeLessThanOrEqual(host.width + 1);
    expect(canvas.height).toBeLessThanOrEqual(host.height + 1);
    await expect(modal.locator('.overview-footer')).toBeInViewport();
  };
  await checkFit();
  const originalSize = page.viewportSize()!;
  if (isMobile) { await page.setViewportSize({ width: 915, height: 412 }); await checkFit(); }
  const box = (await modal.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 10); await page.mouse.up();
  await modal.getByRole('button', { name: '닫기', exact: true }).click();
  if (isMobile) await page.setViewportSize(originalSize);
  await expect(modal).toHaveCount(0);
  expect(await exportJSON(page)).toEqual(before);
});
