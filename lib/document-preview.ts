export function documentFitScale(viewWidth: number, viewHeight: number, width: number, height: number): number {
  if (![viewWidth, viewHeight, width, height].every(value => Number.isFinite(value) && value > 0)) return 1;
  return Math.min(1, viewWidth / width, viewHeight / height);
}
