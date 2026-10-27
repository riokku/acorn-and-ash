import { expect, test } from '@playwright/test';
import {
  ActionKind,
  CHARGE_TICKS,
  HOLLOW_KING,
  LIGHT_COMBO,
  STRIKE,
} from '../packages/shared/src/index';

declare global {
  interface Window {
    acornAdvanceRaiderCombat?: (deltaSeconds: number) => void;
    acornRaiderCombat?: Array<{
      readonly kind: ActionKind;
      readonly age: number;
      readonly step: number;
      readonly warning: string | null;
      readonly opacity: number;
      readonly groundError: number;
      readonly hand: readonly number[];
    }>;
  }
}

test.use({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 0.5 });

for (const kind of ['warrior', 'hollowKing'] as const) {
  test(`${kind} has continuous combat animation and ground-fitted warnings that end with the blow`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '' }));
    for (const demo of ['attack', 'strike']) {
      await page.goto(
        `/?gallery=raiders&kind=${kind}&demo=${demo}&slope=0.15&inspect&renderer=webgl2`,
      );
      await expect(page.locator('body')).toHaveAttribute('data-gallery-ready', 'true', {
        timeout: 120_000,
      });
      const frames = await page.evaluate(() => {
        window.acornRaiderCombat = [];
        for (let frame = 0; frame < 300; frame++) window.acornAdvanceRaiderCombat!(1 / 60);
        return window.acornRaiderCombat;
      });
      expect(frames.length).toBe(300);
      const warnings = frames.filter((f) => f.warning);
      expect(warnings.length).toBeGreaterThan(20);
      expect(Math.max(...warnings.map((f) => f.groundError))).toBeLessThan(0.001);
      const preparing = frames.filter(
        (f) => f.kind === (demo === 'attack' ? ActionKind.Windup : ActionKind.Charge),
      );
      expect(Math.max(...preparing.map((f) => f.opacity))).toBeGreaterThan(preparing[0]!.opacity);
      if (demo === 'attack') {
        expect(warnings.every((f) => f.warning === 'cleave-warning')).toBe(true);
        const recovery = frames.filter(
          (f) => f.kind === ActionKind.Swing && f.age >= LIGHT_COMBO[f.step - 1]!.impact + 2,
        );
        expect(recovery.length).toBeGreaterThan(3);
        expect(recovery.every((f) => !f.warning)).toBe(true);
      } else {
        expect(warnings.every((f) => f.warning === 'whirlwind-warning')).toBe(true);
        const recovery = frames.filter(
          (f) => f.kind === ActionKind.Strike && f.age >= STRIKE.spinEnd,
        );
        expect(recovery.length).toBeGreaterThan(3);
        expect(recovery.every((f) => !f.warning)).toBe(true);
        // The gallery must demonstrate the king's actual two-second charge.
        const fullCharge = kind === 'hollowKing' ? HOLLOW_KING.chargeTicks : CHARGE_TICKS;
        expect(Math.max(...preparing.map((f) => f.age))).toBeGreaterThan(fullCharge - 1);
      }
      const idle = frames.filter((f) => f.kind === ActionKind.Idle);
      expect(idle.length).toBeGreaterThan(5);
      expect(idle.every((f) => !f.warning)).toBe(true);
      const attacking = frames.filter(
        (f) => f.kind === ActionKind.Swing || f.kind === ActionKind.Strike,
      );
      let changed = 0;
      for (let i = 1; i < attacking.length; i++) {
        if (
          attacking[i]!.hand.some(
            (value, axis) => Math.abs(value - attacking[i - 1]!.hand[axis]!) > 0.00001,
          )
        )
          changed++;
      }
      expect(changed / attacking.length).toBeGreaterThan(0.75);
    }
    expect(errors).toEqual([]);
  });
}
