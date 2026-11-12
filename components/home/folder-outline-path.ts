/**
 * A single closed SVG path for the selected training tab AND the folder body.
 *
 * Measured pixel coordinates come from actual DOM rectangles, never hardcoded
 * grid percentages or negative CSS borders. Both outer tab sides and the body
 * perimeter belong to the same path, so there cannot be a dangling seam.
 */
export type FolderOutlineGeometry = {
  width: number;
  height: number;
  bodyTop: number;
  tab?: { left: number; right: number; top: number };
};

const limit = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const pt = (n: number) => Number(n.toFixed(2));

export function makeFolderOutline({ width, height, bodyTop, tab }: FolderOutlineGeometry): string {
  if (![width, height, bodyTop].every(Number.isFinite) || width <= 4 || height <= 4) {
    return "";
  }
  // Half the stroke stays inside the SVG viewport at every zoom level.
  const edge = 0.8;
  const left = edge;
  const right = width - edge;
  const bottom = height - edge;
  const top = limit(bodyTop, edge, bottom - 2);
  const bodyRadius = Math.min(18, (right - left) / 2, (bottom - top) / 2);
  const n = pt;

  const ordinaryFolder = () => [
    `M ${n(left + bodyRadius)} ${n(top)}`,
    `H ${n(right - bodyRadius)}`,
    `Q ${n(right)} ${n(top)} ${n(right)} ${n(top + bodyRadius)}`,
    `V ${n(bottom - bodyRadius)}`,
    `Q ${n(right)} ${n(bottom)} ${n(right - bodyRadius)} ${n(bottom)}`,
    `H ${n(left + bodyRadius)}`,
    `Q ${n(left)} ${n(bottom)} ${n(left)} ${n(bottom - bodyRadius)}`,
    `V ${n(top + bodyRadius)}`,
    `Q ${n(left)} ${n(top)} ${n(left + bodyRadius)} ${n(top)} Z`,
  ].join(" ");

  if (!tab || ![tab.left, tab.right, tab.top].every(Number.isFinite)) {
    return ordinaryFolder();
  }
  const tabLeft = limit(tab.left, left, right);
  const tabRight = limit(tab.right, left, right);
  const tabTop = limit(tab.top, edge, top);
  if (tabRight - tabLeft < 12 || top - tabTop < 10) {
    return ordinaryFolder();
  }

  const tabRadius = Math.min(12, (tabRight - tabLeft) / 2, (top - tabTop) / 2);
  const touchesLeft = tabLeft - left < 1.5;
  const touchesRight = right - tabRight < 1.5;
  const concaveLeft = touchesLeft ? 0 : Math.min(6, (tabLeft - left - bodyRadius) / 2, (top - tabTop) / 3);
  const concaveRight = touchesRight ? 0 : Math.min(6, (right - tabRight - bodyRadius) / 2, (top - tabTop) / 3);
  const lc = Math.max(0, concaveLeft);
  const rc = Math.max(0, concaveRight);

  // Follow the perimeter clockwise from the raised tab's upper-left corner.
  // On the leftmost/rightmost tab, continue straight along the outer body
  // edge; for interior tabs, draw just one continuous concave join.
  const path = [
    `M ${n(tabLeft + tabRadius)} ${n(tabTop)}`,
    `H ${n(tabRight - tabRadius)}`,
    `Q ${n(tabRight)} ${n(tabTop)} ${n(tabRight)} ${n(tabTop + tabRadius)}`,
  ];
  if (touchesRight) {
    path.push(`V ${n(bottom - bodyRadius)}`);
  } else {
    path.push(
      `V ${n(top - rc)}`,
      `Q ${n(tabRight)} ${n(top)} ${n(tabRight + rc)} ${n(top)}`,
      `H ${n(right - bodyRadius)}`,
      `Q ${n(right)} ${n(top)} ${n(right)} ${n(top + bodyRadius)}`,
      `V ${n(bottom - bodyRadius)}`,
    );
  }
  path.push(
    `Q ${n(right)} ${n(bottom)} ${n(right - bodyRadius)} ${n(bottom)}`,
    `H ${n(left + bodyRadius)}`,
    `Q ${n(left)} ${n(bottom)} ${n(left)} ${n(bottom - bodyRadius)}`,
  );
  if (touchesLeft) {
    path.push(`V ${n(tabTop + tabRadius)}`);
  } else {
    path.push(
      `V ${n(top + bodyRadius)}`,
      `Q ${n(left)} ${n(top)} ${n(left + bodyRadius)} ${n(top)}`,
      `H ${n(tabLeft - lc)}`,
      `Q ${n(tabLeft)} ${n(top)} ${n(tabLeft)} ${n(top - lc)}`,
      `V ${n(tabTop + tabRadius)}`,
    );
  }
  path.push(
    `Q ${n(tabLeft)} ${n(tabTop)} ${n(tabLeft + tabRadius)} ${n(tabTop)} Z`,
  );
  return path.join(" ");
}
