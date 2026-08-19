# Certificate Editor Preview Toolbar and Density Refinement

## Status

Approved for implementation by the product owner on 2026-08-14.

## Goal

Give the certificate editor a canvas-first workspace: the preview uses the available width, global actions live in a single compact preview header, and the properties inspector uses short, consistent controls with clear grouping.

## Decisions

- Put the global toolbar in the preview header, on the same line as `Preview`.
- Use icon-only controls for undo, horizontal centering, vertical centering, and field visibility; every icon has an accessible label and tooltip. Use a compact text toggle for `Dados longos` / `Dados curtos` because the words communicate the state better than an icon.
- Remove the origin action.
- Remove external workspace padding and the extra surface that constrained the preview; the certificate frame may retain its own border/radius as the art boundary.
- Keep save/publish actions in the session header.
- Rename the sample-data control to `Dados longos` or `Dados curtos` based on the active variant.
- Keep the selected field inspector contextual. Remove the repeated unit explanation from the geometry group.
- Separate `Posição` (`Horizontal`, `Vertical`) from `Tamanho` (`Largura`, `Altura`). Keep sliders, but commit/display integer percentages only.
- Standardize compact controls: smaller input/select heights, short gaps, inline label/control rows, and alignment controls on the same row as their labels.
- Replace the Radix popover color editor with a direct native color input trigger and a visually compact HEX text input fallback; do not add a second popover layer.
- Keep diagnostics about the template below the preview in the properties column. Keep warnings rendered directly over the certificate artwork in the preview. Diagnostics must name the problem directly.

## Scope

### In scope

- `certificate-template-form.tsx`: workspace padding, preview header toolbar, diagnostic placement, sample toggle copy, compact layout.
- `certificate-template-fields.tsx`: compact controls, separate position/size groups, inline alignment rows, integer slider/input values.
- `certificate-template-preview.tsx` and `certificate-template-overlap-notice.tsx`: preserve canvas warnings and make below-canvas diagnostics direct.
- `src/components/ui/color-picker.tsx`: direct native color input/HEX control without Popover.
- Editor, geometry, layout, and color interaction tests.

### Out of scope

- Certificate schema/API changes.
- New UI dependencies, canvas renderer replacement, group transforms, or persisted undo history.

## Acceptance criteria

1. Preview header contains `Preview` plus the compact global toolbar on one line at desktop widths.
2. The workspace has no redundant outer padding/surface constraining the certificate art; properties remains bounded and internally scrollable.
3. Toolbar controls share the same compact button variant and have accessible names/tooltips.
4. No origin button remains; sample data reads `Dados longos` or `Dados curtos`.
5. Alignment labels and icon toggles share one row; position and size are separate groups.
6. Numeric geometry values are displayed and committed as integers; slider ranges still clamp safely.
7. Color opens directly through the native color control and exposes HEX editing without a Radix popover.
8. Below-preview diagnostics are rendered in properties; canvas warnings remain over the artwork and identify the issue directly.

## Verification

- `bun run test`
- `bun run typecheck`
- `bun run check`
- `bun run docs:check`
- `bun run db:migrations:check`
