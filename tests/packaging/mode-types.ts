import type { ModeProviderProps } from '@ui-lazy-dev/ui-web/modes';
import { createTheme, registerBrand, type TokenPatch } from '@ui-lazy-dev/tokens/modes';

export const registered = registerBrand('partner', {
  base: { 'color.surface': '{color.canvas}', 'space.spaceMd': 12 },
  density: { spacious: { 'type.bodySize': '{size.control}' } },
});
createTheme({ brands: [registered] }).resolve({ density: 'compact', scheme: 'high-contrast' });

// @ts-expect-error Color inputs require a color value or another color role.
const wrongAlias: TokenPatch = { 'color.surface': '{type.bodySize}' };
// @ts-expect-error An alias must preserve units, including duration versus dimension.
const wrongUnit: TokenPatch = { 'motion.enterDuration': '{size.control}' };
// @ts-expect-error Consumer patches may reference only public semantic paths.
registerBrand('partner', { base: { 'palette.white': '#ffffff' } });

// Scoped appearance is controlled by the documented axes.
type RequireTrue<T extends true> = T;
export type ModeProviderOmitsTheme = RequireTrue<'theme' extends keyof ModeProviderProps ? false : true>;
