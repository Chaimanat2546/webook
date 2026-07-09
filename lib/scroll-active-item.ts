export function scrollActiveItemToStart(activeItem: HTMLElement) {
  const viewport = activeItem.closest('[data-slot="scroll-area-viewport"]');
  if (!(viewport instanceof HTMLElement)) return;

  const itemRect = activeItem.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();

  viewport.scrollTo({
    behavior: "smooth",
    left: viewport.scrollLeft + itemRect.left - viewportRect.left,
  });
}
