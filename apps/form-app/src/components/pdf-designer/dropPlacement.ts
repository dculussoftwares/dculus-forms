/**
 * Maps a pointer position (client px) onto a pdfme Designer page in
 * template millimetres.
 *
 * pdfme renders each page ("paper") as a div whose untransformed size is
 * `pageSizeMm * ZOOM` px (ZOOM = 96dpi / 25.4), all inside one wrapper
 * carrying `transform: scale(...)` with `transformOrigin: top left`
 * (see @pdfme/ui Paper.tsx). That means, per paper element:
 *
 *   scale        = boundingRect.width / offsetWidth
 *   pageWidthMm  = offsetWidth  / ZOOM
 *   mmX          = (clientX - rect.left) / scale / ZOOM
 *
 * — no access to pdfme internals or the current zoom level required.
 */

export const ZOOM = 3.7795275591; // px per mm, mirrors @pdfme/ui's constant

// Pointer may be slightly off-page and still count as a drop on that page
const SNAP_MARGIN_PX = 12;

/** JotForm-style layout grid shown while dragging from the palette */
export const GRID_COLUMNS = 12;
/** Vertical snap step in mm */
export const ROW_STEP_MM = 5;
/** Snap only when within this distance of a grid line, in mm */
const SNAP_THRESHOLD_MM = 4;

export interface DropTarget {
  pageIndex: number;
  /** Pointer position on the page, in mm */
  point: { x: number; y: number };
  /** Page size in mm */
  pageSize: { width: number; height: number };
}

/**
 * The paper divs are the children of the (single) scale wrapper: a div
 * styled with `transform: scale(...)` + `transformOrigin: top left` whose
 * children all carry a background image (the rendered page). Child order
 * matches template page order.
 */
export function findPaperElements(container: HTMLElement): HTMLElement[] {
  for (const el of Array.from(container.querySelectorAll<HTMLElement>('div'))) {
    // CSSOM serializes 'top left' back as 'left top' — compare order-agnostically
    const origin = el.style.transformOrigin;
    if (
      origin.includes('top') &&
      origin.includes('left') &&
      el.style.transform.startsWith('scale(') &&
      el.children.length > 0 &&
      Array.from(el.children).every(
        (child) =>
          child instanceof HTMLElement && child.style.backgroundImage.includes('url(')
      )
    ) {
      return Array.from(el.children) as HTMLElement[];
    }
  }
  return [];
}

/**
 * Resolve which page (if any) a pointer drop lands on and where, in mm.
 * Returns null when the pointer is not on a page (beyond the snap margin) —
 * callers should treat that as a cancelled drop.
 */
export function resolveDropTarget(
  container: HTMLElement,
  clientX: number,
  clientY: number
): DropTarget | null {
  const papers = findPaperElements(container);

  for (let pageIndex = 0; pageIndex < papers.length; pageIndex++) {
    const paper = papers[pageIndex];
    const rect = paper.getBoundingClientRect();
    if (rect.width === 0 || paper.offsetWidth === 0) continue;
    if (
      clientX < rect.left - SNAP_MARGIN_PX ||
      clientX > rect.right + SNAP_MARGIN_PX ||
      clientY < rect.top - SNAP_MARGIN_PX ||
      clientY > rect.bottom + SNAP_MARGIN_PX
    ) {
      continue;
    }

    const scale = rect.width / paper.offsetWidth;
    return {
      pageIndex,
      point: {
        x: (clientX - rect.left) / scale / ZOOM,
        y: (clientY - rect.top) / scale / ZOOM,
      },
      pageSize: {
        width: paper.offsetWidth / ZOOM,
        height: paper.offsetHeight / ZOOM,
      },
    };
  }
  return null;
}

/**
 * Center a w×h element on the drop point, clamped fully inside the page.
 */
export function centeredClampedPosition(
  target: DropTarget,
  width: number,
  height: number
): { x: number; y: number } {
  const clamp = (value: number, max: number) =>
    Math.max(0, Math.min(value, Math.max(0, max)));
  return {
    x: clamp(target.point.x - width / 2, target.pageSize.width - width),
    y: clamp(target.point.y - height / 2, target.pageSize.height - height),
  };
}

/**
 * Centered position with JotForm-style guided snapping: the element's left
 * edge snaps to the nearest column line of a GRID_COLUMNS grid and its top
 * to a ROW_STEP_MM grid, but only when already close (SNAP_THRESHOLD_MM) —
 * free placement elsewhere. Result is clamped inside the page. Used for
 * both the live drag ghost and the actual drop, so the ghost is exact.
 */
export function snappedDropPosition(
  target: DropTarget,
  width: number,
  height: number
): { x: number; y: number } {
  const centered = centeredClampedPosition(target, width, height);
  const columnWidth = target.pageSize.width / GRID_COLUMNS;

  const snapAxis = (value: number, step: number) => {
    const nearest = Math.round(value / step) * step;
    return Math.abs(nearest - value) <= SNAP_THRESHOLD_MM ? nearest : value;
  };

  const clamp = (value: number, max: number) =>
    Math.max(0, Math.min(value, Math.max(0, max)));

  return {
    x: clamp(snapAxis(centered.x, columnWidth), target.pageSize.width - width),
    y: clamp(snapAxis(centered.y, ROW_STEP_MM), target.pageSize.height - height),
  };
}

export interface PaperViewport {
  pageIndex: number;
  /** Paper rect relative to the given container element, in px */
  rect: { left: number; top: number; width: number; height: number };
  /** Current render scale (px per untransformed px) */
  scale: number;
  /** Page size in mm */
  pageSize: { width: number; height: number };
}

/**
 * Geometry of every rendered page relative to `container` — drives the
 * drag-time grid overlay and the floating selection toolbar.
 */
export function getPaperViewports(container: HTMLElement): PaperViewport[] {
  const containerRect = container.getBoundingClientRect();
  return findPaperElements(container).flatMap((paper, pageIndex) => {
    const rect = paper.getBoundingClientRect();
    if (rect.width === 0 || paper.offsetWidth === 0) return [];
    return [
      {
        pageIndex,
        rect: {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top,
          width: rect.width,
          height: rect.height,
        },
        scale: rect.width / paper.offsetWidth,
        pageSize: {
          width: paper.offsetWidth / ZOOM,
          height: paper.offsetHeight / ZOOM,
        },
      },
    ];
  });
}
