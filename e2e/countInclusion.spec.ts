import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function blank(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('(예시)');
  await page.getByRole('button', { name: '배치 목록', exact: true }).click();
  await page.getByLabel('새 배치 이름').fill('수량 포함 테스트');
  await page.getByRole('button', { name: '빈 무대로 만들기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function redPixels(page: Page, scope = '[data-testid="stage"]') {
  return page.locator(`${scope} canvas`).evaluateAll(canvases => canvases.reduce((total, canvas) => {
    const c = canvas as HTMLCanvasElement;
    const pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - 220) < 3 && Math.abs(pixels[i + 1] - 38) < 3 && Math.abs(pixels[i + 2] - 38) < 3 && pixels[i + 3] > 200) count++;
    return total + count;
  }, 0));
}

async function exported(page: Page) {
  await page.getByRole('button', { name: '출력·내보내기' }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON 내보내기', exact: true }).click();
  const data = JSON.parse(await readFile((await (await event).path())!, 'utf8'));
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  return data;
}

async function selectCenter(page: Page) {
  const stage = page.getByTestId('stage');
  await stage.scrollIntoViewIfNeeded();
  const box = (await stage.boundingBox())!;
  await stage.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await page.getByRole('button', { name: '선택한 세트', exact: true }).click();
}

test('포함 기본값·제외 수량·빨간 테두리·복원·새 세트 기본값', async ({ page }) => {
  await blank(page);
  await page.locator('.add-fields').getByLabel('악기', { exact: true }).selectOption({ label: '바이올린' });
  await page.getByRole('button', { name: '무대에 추가', exact: true }).click();
  const checkbox = page.getByRole('checkbox', { name: '준비 수량에 포함', exact: true });
  await expect(checkbox).toBeChecked();
  expect(await redPixels(page)).toBe(0);
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  await expect(page.locator('.count-excluded-note')).toContainText('준비 수량 제외');
  await expect.poll(() => redPixels(page)).toBeGreaterThan(50);
  await page.getByRole('button', { name: '준비 수량', exact: true }).click();
  for (const key of ['stands', 'chairs', 'benches', 'tallChairs']) await expect(page.getByRole('complementary').getByTestId(`total-${key}`)).toHaveText('0개');
  await expect(page.getByRole('complementary').locator('.group-table tbody')).toContainText('아직 배치한 세트가 없습니다.');
  await page.getByLabel('예비 의자', { exact: true }).fill('2');
  await expect(page.getByRole('complementary').getByTestId('total-chairs')).toHaveText('2개');
  await page.getByRole('button', { name: '선택한 세트', exact: true }).click();
  await checkbox.check();
  await expect.poll(() => redPixels(page)).toBe(0);
  await page.getByRole('button', { name: '실행 취소', exact: true }).click();
  await expect(checkbox).not.toBeChecked();
  await expect.poll(() => redPixels(page)).toBeGreaterThan(50);
  await page.getByRole('button', { name: '다시 실행', exact: true }).click();
  await expect(checkbox).toBeChecked();
  await page.getByRole('button', { name: '준비 수량', exact: true }).click();
  await expect(page.getByRole('complementary').getByTestId('total-stands')).toHaveText('1개');
  await expect(page.getByRole('complementary').getByTestId('total-chairs')).toHaveText('4개');
  await page.getByRole('button', { name: '선택한 세트', exact: true }).click();
  await checkbox.uncheck();
  await page.getByRole('button', { name: '무대에 추가', exact: true }).click();
  await expect(checkbox).toBeChecked();
  const data = await exported(page);
  expect(data.layout.data.items[0].includeInCounts).toBe(false);
  expect(data.layout.data.items[1].includeInCounts).toBeUndefined();
});

test('제외 설정 저장·JSON 복원·출력 테두리·열람 권한', async ({ page }) => {
  await blank(page);
  await page.locator('.add-fields').getByLabel('악기', { exact: true }).selectOption({ label: '바이올린' });
  await page.getByRole('button', { name: '키큰의자+보면대2', exact: true }).click();
  await page.getByRole('button', { name: '무대에 추가', exact: true }).click();
  const checkbox = page.getByRole('checkbox', { name: '준비 수량에 포함', exact: true });
  await checkbox.uncheck();
  await page.getByRole('button', { name: '메모리에 저장', exact: true }).click();
  const data = await exported(page);
  expect(data.layout.data.items[0].includeInCounts).toBe(false);
  await page.getByRole('button', { name: '출력·내보내기' }).click();
  await expect.poll(() => redPixels(page, '.output-preview')).toBeGreaterThan(50);
  await expect(page.getByRole('dialog').getByTestId('total-tallChairs')).toHaveText('0개');
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('(예시)');
  await page.locator('input[type=file]').setInputFiles({ name: 'included.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('수량 포함 테스트');
  await expect.poll(() => redPixels(page)).toBeGreaterThan(50);
  await selectCenter(page);
  await expect(checkbox).not.toBeChecked();
  await page.getByLabel('데모 권한').selectOption('viewer');
  await expect(checkbox).toBeDisabled();
  await expect(checkbox).not.toBeChecked();
  await expect.poll(() => redPixels(page)).toBeGreaterThan(50);
  await page.getByLabel('데모 권한').selectOption('admin');
  await checkbox.check();
  await page.getByRole('button', { name: '준비 수량', exact: true }).click();
  await expect(page.getByRole('complementary').getByTestId('total-stands')).toHaveText('2개');
  await expect(page.getByRole('complementary').getByTestId('total-tallChairs')).toHaveText('1개');
});
