import { GRID_COLUMNS, getPaperViewports } from './dropPlacement';

/**
 * Injects the 12-column layout grid into pdfme's rulers as real guide
 * lines, so elements *snap* to columns while being moved/resized — pdfme
 * feeds each page's ruler guides to react-moveable as snap guidelines
 * (values are stored in mm; see @pdfme/ui's getGuideLines).
 *
 * react-guides exposes getGuides()/loadGuides() only on its component
 * instance, which pdfme keeps in internal refs — reached here by walking
 * the React fiber from the ruler's DOM node. Best-effort by design: any
 * failure (pdfme/react internals change) degrades to "no column snapping"
 * while the visual drag grid overlay keeps working.
 *
 * Guide visibility is styled in index.css: lines are hidden while idle and
 * shown during element moves / palette drags (data-guides-visible) or when
 * hovering a ruler.
 */

function guidesInstanceFromDom(el: Element): any | null {
  const fiberKey = Object.keys(el).find((key) => key.startsWith('__reactFiber$'));
  let fiber: any = fiberKey ? (el as any)[fiberKey] : null;
  for (let hops = 0; fiber && hops < 12; hops++) {
    const node = fiber.stateNode;
    if (node && typeof node.getGuides === 'function' && typeof node.loadGuides === 'function') {
      return node;
    }
    fiber = fiber.return;
  }
  return null;
}

export function loadColumnGuides(container: HTMLElement): void {
  try {
    const papers = getPaperViewports(container);
    const rulers = Array.from(
      container.querySelectorAll('.scena-guides-manager.scena-guides-vertical')
    );

    rulers.forEach((ruler, index) => {
      const pageWidth = papers[index]?.pageSize.width;
      const instance = guidesInstanceFromDom(ruler);
      if (!pageWidth || !instance) return;

      const columnWidth = pageWidth / GRID_COLUMNS;
      const columns = Array.from({ length: GRID_COLUMNS - 1 }, (_, i) =>
        Math.round((i + 1) * columnWidth * 100) / 100
      );
      const existing: number[] = instance.getGuides() ?? [];
      const merged = [
        ...existing,
        ...columns.filter((col) => !existing.some((g) => Math.abs(g - col) < 0.5)),
      ];
      instance.loadGuides(merged);
    });
  } catch {
    // snapping is an enhancement — never let it break the designer
  }
}
