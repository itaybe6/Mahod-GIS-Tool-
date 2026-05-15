/**
 * Shared modern, RTL map-popup design system.
 *
 * Both the Mapbox GL (3D) and Leaflet (2D) maps share the same look-and-feel
 * via the `mahod-popup` wrapper class and the `.mp-*` card primitives that
 * live in `src/styles/rtl.css`. Use {@link buildMapPopupHtml} to render the
 * popup body as an HTML string, and pass {@link MAP_POPUP_CLASS} to
 * `mapboxgl.Popup({ className })` or to the `<Popup className>` prop in
 * react-leaflet so the wrapper picks up the glassmorphism, accent bar,
 * RTL close button and animation styles.
 */

export const MAP_POPUP_CLASS = 'mahod-popup';

export type PopupBadgeTone = 'high' | 'medium' | 'low' | 'success' | 'neutral' | 'info';

export interface MapPopupRow {
  key: string;
  value: string | number;
}

export interface MapPopupOptions {
  /** Hex accent colour used for the top bar, pulse dot and eyebrow. */
  accent: string;
  /** Small uppercase label above the title (e.g. "מוקד תאונות"). */
  eyebrow?: string;
  /** Main title — typically the feature name. */
  title: string;
  /** Optional large highlight stat (e.g. accident count). */
  highlight?: { value: string | number; label: string };
  /** Key / value rows displayed under the highlight. */
  rows?: ReadonlyArray<MapPopupRow>;
  /** Optional pill-shaped badge at the bottom of the card. */
  badge?: { tone: PopupBadgeTone; label: string };
}

/**
 * Builds the popup body HTML. The output should be passed straight to
 * `Popup.setHTML(...)` (Mapbox GL) or rendered via
 * `<div dangerouslySetInnerHTML>` inside a react-leaflet `<Popup>`.
 *
 * All caller-provided strings are HTML-escaped. The accent colour is
 * inlined as a CSS custom property so each popup can theme itself without
 * needing an extra class.
 */
export function buildMapPopupHtml(opts: MapPopupOptions): string {
  const accent = sanitizeColor(opts.accent);
  const eyebrow = opts.eyebrow ? `<div class="mp-eyebrow">${escHtml(opts.eyebrow)}</div>` : '';
  const title = `<div class="mp-title">${escHtml(opts.title)}</div>`;

  const highlight = opts.highlight
    ? `<div class="mp-highlight">
         <div class="mp-highlight-value">${escHtml(String(opts.highlight.value))}</div>
         <div class="mp-highlight-label">${escHtml(opts.highlight.label)}</div>
       </div>`
    : '';

  const rowsHtml =
    opts.rows && opts.rows.length > 0
      ? `<div class="mp-rows">${opts.rows
          .map(
            (r) =>
              `<div class="mp-row">
                 <span class="mp-key">${escHtml(r.key)}</span>
                 <span class="mp-val">${escHtml(String(r.value))}</span>
               </div>`,
          )
          .join('')}</div>`
      : '';

  const badge = opts.badge
    ? `<div class="mp-badge mp-badge-${opts.badge.tone}">
         <span class="mp-badge-dot"></span>
         <span>${escHtml(opts.badge.label)}</span>
       </div>`
    : '';

  return `<div class="mp-card" style="--mp-accent:${accent}">
    <div class="mp-accent" aria-hidden="true"></div>
    <div class="mp-content">
      <div class="mp-header">
        <span class="mp-pulse" aria-hidden="true"></span>
        <div class="mp-titles">${eyebrow}${title}</div>
      </div>
      ${highlight}
      ${rowsHtml}
      ${badge ? `<div class="mp-badge-wrap">${badge}</div>` : ''}
    </div>
  </div>`;
}

/**
 * Allow only safe characters in the accent colour string before inlining it
 * into a `style="..."` attribute, so a malformed value (e.g. one coming from
 * external GeoJSON) cannot break out of the property.
 */
function sanitizeColor(value: string): string {
  return /^[#a-zA-Z0-9(),.\s%]+$/.test(value) ? value : '#2eaa6f';
}

function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
