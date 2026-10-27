import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function blank(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('(예시)');
  await page.getByRole('button', { name: '배치 목록', exact: true }).click();
  await page.getByLabel('새 배치 이름').fill('새 패치 확인');
  await page.getByRole('button', { name: '빈 무대로 만들기' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function data(page: Page) {
  await page.getByRole('button', { name: '출력·내보내기' }).click();
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON 내보내기', exact: true }).click();
  const json = JSON.parse(await readFile((await (await event).path())!, 'utf8'));
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  return json.layout.data;
}

async function dragCenter(page: Page, mobile: boolean) {
  await page.getByTestId('stage').scrollIntoViewIfNeeded();
  const box = (await page.getByTestId('stage').boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  if (mobile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let n = 1; n <= 10; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 60 * n / 10, y: y + 35 * n / 10 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + 60, y + 35, { steps: 10 }); await page.mouse.up();
  }
}

test('이름표 이동 모드와 정지에서 서로 다른 객체가 움직인다', async ({ page, isMobile }) => {
  await blank(page);
  await page.getByRole('button', { name: '무대에 추가', exact: true }).click();
  const before = await data(page);
  await page.getByRole('button', { name: '이름표 옮기기', exact: true }).click();
  await expect(page.getByRole('button', { name: '이름표 이동 정지', exact: true })).toBeEnabled();
  await dragCenter(page, isMobile);
  const labelMoved = await data(page);
  expect(labelMoved.items[0].x).toBe(before.items[0].x);
  expect(labelMoved.items[0].y).toBe(before.items[0].y);
  expect(labelMoved.items[0].labelPosition).toBe('custom');
  expect(labelMoved.items[0].labelOffset.x).toBeGreaterThan(0);
  await page.getByRole('button', { name: '이름표 이동 정지', exact: true }).click();
  await page.getByRole('button', { name: '선택한 세트', exact: true }).click();
  await page.getByRole('button', { name: '가운데', exact: true }).click();
  await dragCenter(page, isMobile);
  const bodyMoved = await data(page);
  expect(bodyMoved.items[0].x).not.toBe(before.items[0].x);
  expect(bodyMoved.items[0].labelOffset).toBeUndefined();
  await expect(page.getByRole('button', { name: '이름표 이동 정지', exact: true })).toBeDisabled();
});

test('앞뒤 반전·5방향 이름표·출력 및 JSON 복원', async ({ page }) => {
  await blank(page);
  await page.getByRole('button', { name: '무대에 추가', exact: true }).click();
  await page.getByLabel('세트 Y 위치').fill('300');
  await page.getByLabel('회전 각도').fill('30');
  for (const name of ['위쪽', '아래쪽', '왼쪽', '오른쪽', '가운데']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('button', { name: '위쪽', exact: true }).click();
  await page.getByRole('button', { name: '무대 앞뒤 반전', exact: true }).click();
  await expect(page.locator('.layout-tools')).toContainText('무대 앞: 위쪽');
  const flipped = await data(page);
  expect(flipped.stage.frontAtTop).toBe(true);
  expect(flipped.items[0]).toMatchObject({ y: 700, rotation: 150, labelPosition: 'bottom' });
  await page.getByRole('button', { name: '메모리에 저장', exact: true }).click();
  await page.getByRole('button', { name: '출력·내보내기' }).click();
  await expect(page.locator('.output-preview canvas')).toHaveCount(1);
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('(예시)');
  const file = { format: 'orchestra-seating-layout', formatVersion: 1, layout: { name: '반전 복원', kind: 'event', eventDate: null, data: flipped } };
  await page.locator('input[type=file]').setInputFiles({ name: 'flipped.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('반전 복원');
  expect((await data(page)).items[0].labelPosition).toBe('bottom');
});

test('장의자 3종·1200 길이와 모든 악기 1~5 선택', async ({ page }) => {
  await blank(page);
  const fields = page.locator('.add-fields');
  const inst = fields.getByLabel('악기', { exact: true });
  const options = await inst.locator('option').evaluateAll(nodes => nodes.map(n => ({ value: (n as HTMLOptionElement).value, name: n.textContent! })).filter(n => n.value));
  for (const option of options) {
    await inst.selectOption(option.value);
    const parts = fields.getByLabel('파트', { exact: true });
    await expect(parts.locator('option')).toHaveCount(6);
    await parts.selectOption({ label: option.name === '바이올린' ? '제5바이올린' : `${option.name} 5` });
  }
  await inst.selectOption({ label: '첼로' });
  await fields.getByLabel('파트', { exact: true }).selectOption({ label: '첼로 5' });
  for (const name of ['장의자', '장의자+보면대1', '장의자+보면대2']) {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('button', { name: '무대에 추가', exact: true }).click();
    await page.getByLabel('장의자 길이', { exact: true }).fill('1200');
    await expect(page.getByLabel('장의자 길이', { exact: true })).toHaveValue('1200');
  }
  await page.getByRole('button', { name: '준비 수량', exact: true }).click();
  await expect(page.getByRole('complementary').getByTestId('total-stands')).toHaveText('3개');
  await expect(page.getByRole('complementary').getByTestId('total-chairs')).toHaveText('0개');
  await expect(page.getByRole('complementary').getByTestId('total-benches')).toHaveText('3개');
  const saved = await data(page);
  expect(saved.items.every((i: { benchLength: number }) => i.benchLength === 1200)).toBe(true);
});
