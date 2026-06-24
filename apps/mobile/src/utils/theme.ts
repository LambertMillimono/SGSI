/** Design tokens for SGSI mobile — matches the desktop Nova design system */
export const colors = {
  /* Indigo brand */
  primary:       '#6366F1',
  primaryDark:   '#4F46E5',
  primaryLight:  '#818CF8',
  primaryBg:     'rgba(99,102,241,0.12)',

  /* Semantic */
  success:       '#059669',
  successBg:     'rgba(5,150,105,0.12)',
  warning:       '#F59E0B',
  warningBg:     'rgba(245,158,11,0.12)',
  danger:        '#DC2626',
  dangerBg:      'rgba(220,38,38,0.12)',
  info:          '#06B6D4',
  infoBg:        'rgba(6,182,212,0.12)',

  /* Dark surfaces (OLED warm) */
  bgBase:        '#0F0F1A',
  bgSurface:     '#1A1A2E',
  bgElevated:    '#252540',
  bgCard:        '#1A1A2E',

  /* Borders */
  border:        'rgba(99,102,241,0.15)',
  borderSubtle:  'rgba(99,102,241,0.08)',

  /* Text */
  textPrimary:   '#F0EFFF',
  textSecondary: '#A0A0C0',
  textMuted:     '#6B6B8A',
  textDisabled:  '#3A3A58',

  /* White / misc */
  white:         '#FFFFFF',
  black:         '#000000',
}

export const spacing = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  '3xl': 32,
  '4xl': 40,
}

export const radius = {
  xs:   4,
  sm:   6,
  md:   10,
  lg:   14,
  xl:   18,
  full: 9999,
}

export const typography = {
  display:  { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.8 },
  h1:       { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.4 },
  h2:       { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3:       { fontSize: 15, fontWeight: '600' as const, letterSpacing: -0.2 },
  body:     { fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
  bodyBold: { fontSize: 14, fontWeight: '600' as const },
  small:    { fontSize: 12, fontWeight: '400' as const },
  label:    { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.6, textTransform: 'uppercase' as const },
  mono:     { fontSize: 13, fontFamily: 'monospace' as const, fontWeight: '600' as const },
}

export const shadow = {
  sm:  { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4,  elevation: 3 },
  md:  { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,  elevation: 6 },
  lg:  { shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8 },
}
