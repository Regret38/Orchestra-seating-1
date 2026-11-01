import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function exportData(page: Page) {
  await page.getByRole('button', { name: '출력·내보내기' }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON 내보내기', exact: true }).click();
  const result = JSON.parse(await readFile((await (await event).path())!, 'utf8'));
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  return result.layout.data;
}
async function open(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('(예시)');
  const before = await exportData(page);
  await page.getByRole('button', { name: '전체 보기', exact: true }).click();
  await expect(page.getByRole('dialog', { name: /^무대 전체 보기/ })).toBeVisible();
  await expect(page.getByRole('status', { name: '전체 보기 배율' })).toHaveText('100%');
  return before;
}
async function attached(page: Page) {
  const canvas = (await page.getByTestId('overview-stage').locator('canvas').boundingBox())!;
  const caption = (await page.locator('.overview-footer').boundingBox())!;
  expect(Math.abs(caption.y - canvas.y - canvas.height)).toBeLessThan(2);
  expect(Math.abs(caption.width - canvas.width)).toBeLessThan(2);
}

test('확대·축소·맞춤 버튼과 무대 사진 바로 아래의 작은 수량 표시', async ({ page }) => {
  const before = await open(page);
  const modal = page.getByRole('dialog', { name: /^무대 전체 보기/ });
  await attached(page);
  expect((await page.locator('.overview-footer').boundingBox())!.height).toBeLessThan(70);
  await expect(modal.getByTestId('overview-stands')).toHaveText('35개');
  await expect(modal.getByTestId('overview-chairs')).toHaveText('46개');
  await expect(page.getByRole('button', { name: '전체 보기 축소', exact: true })).toBeDisabled();
  const originalWidth = (await modal.locator('canvas').boundingBox())!.width;
  await page.getByRole('button', { name: '전체 보기 확대', exact: true }).click();
  await expect(page.getByRole('status', { name: '전체 보기 배율' })).toHaveText('125%');
  expect((await modal.locator('canvas').boundingBox())!.width).toBeCloseTo(originalWidth * 1.25, 0);
  await attached(page);
  await page.getByRole('button', { name: '전체 보기 축소', exact: true }).click();
  await expect(page.getByRole('status', { name: '전체 보기 배율' })).toHaveText('100%');
  for (let n = 0; n < 4; n++) await page.getByRole('button', { name: '전체 보기 확대', exact: true }).click();
  await page.getByRole('button', { name: '전체 보기 화면 맞춤', exact: true }).click();
  await expect(page.getByRole('status', { name: '전체 보기 배율' })).toHaveText('100%');
  await attached(page);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  expect(await exportData(page)).toEqual(before);
});

test('확대 후 드래그 이동과 PC 휠 확대, 닫기 후 원본 유지', async ({ page, isMobile }) => {
  const before = await open(page);
  const stage = page.getByTestId('overview-stage');
  for (let n = 0; n < 4; n++) await page.getByRole('button', { name: '전체 보기 확대', exact: true }).click();
  const rect = (await stage.boundingBox())!;
  const initialX = (await page.locator('.overview-paper').boundingBox())!.x;
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  if (isMobile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    for (let n = 1; n <= 8; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + n * 5, y: y + n * 2, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 40, y + 16, { steps: 8 }); await page.mouse.up();
  }
  await expect.poll(async () => (await page.locator('.overview-paper').boundingBox())!.x).toBeGreaterThan(initialX + 10);
  await attached(page);
  await page.getByRole('button', { name: '전체 보기 화면 맞춤', exact: true }).click();
  if (!isMobile) {
    await page.mouse.move(x, y); await page.mouse.wheel(0, -250);
    await expect.poll(async () => Number((await page.getByRole('status', { name: '전체 보기 배율' }).textContent())!.replace('%', ''))).toBeGreaterThan(100);
    await page.mouse.wheel(0, -4000);
    await expect(page.getByRole('status', { name: '전체 보기 배율' })).toHaveText('600%');
    await expect(page.getByRole('button', { name: '전체 보기 확대', exact: true })).toBeDisabled();
  }
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  expect(await exportData(page)).toEqual(before);
});

test('모바일 두 손가락 확대·축소와 가로 전환 후 사진 및 수량 함께 맞춤', async ({ page, isMobile }) => {
  test.skip(!isMobile, '모바일 터치 전용');
  const before = await open(page);
  const rect = (await page.getByTestId('overview-stage').boundingBox())!;
  const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const points = (spread: number) => [{ x: x - spread, y, id: 1 }, { x: x + spread, y, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(40) });
  for (let n = 1; n <= 10; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(40 + n * 6) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Number((await page.getByRole('status', { name: '전체 보기 배율' }).textContent())!.replace('%', ''))).toBeGreaterThan(200);
  await attached(page);
  expect(await page.evaluate(() => visualViewport!.scale)).toBeCloseTo(1);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(100) });
  for (let n = 1; n <= 10; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(100 - n * 6) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
  await expect(page.getByRole('status', { name: '전체 보기 배율' })).toHaveText('100%');
  await page.getByRole('button', { name: '전체 보기 확대', exact: true }).click();
  await page.setViewportSize({ width: 915, height: 412 });
  await expect(page.getByRole('status', { name: '전체 보기 배율' })).toHaveText('100%');
  await attached(page);
  await expect(page.locator('.overview-footer')).toBeInViewport();
  await expect(page.getByTestId('overview-stage').locator('canvas')).toBeInViewport();
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  expect(await exportData(page)).toEqual(before);
});
