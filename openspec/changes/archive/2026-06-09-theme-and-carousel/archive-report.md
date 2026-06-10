# Archive Report: theme-and-carousel

**Date**: 2026-06-09
**Status**: COMPLETED
**Mode**: hybrid (openspec filesystem + engram)
**Branch**: feature/theme-and-carousel
**PR Strategy**: Single PR (as recommended by tasks.md)

---

## 1. Change Summary

The `theme-and-carousel` change has been successfully planned, implemented, verified, and archived. This change introduces light theme custom variables to the Mundo-3D PICO-8 design system, a persistent theme toggle header button that collapses on mobile, and a text-based, compact LCD carousel.

Major features delivered:
1. **Light Theme support**: Defined the custom properties (`--bg`, `--fg`, `--accent`, `--surface`) mapping to the light palette (`#f5f0e8`, `#1a2a4a`, `#8b7355`, `#ffffff` respectively) under `[data-theme="light"]` in `public/css/styles.css`.
2. **FOUC Prevention**: Added a synchronous inline JavaScript execution block inside the `<head>` of `src/views/partials/head.ejs` to parse `localStorage` preference and apply the `data-theme` attribute to the `<html>` element before first paint.
3. **Theme Toggle controls**: Created a theme switch button inside the header partial (`src/views/partials/header.ejs`) referencing `public/js/theme.js` to handle click events, toggle between `dark` and `light` states, and save the active preference in `localStorage`.
4. **Responsive Theme UI**: Built media query rules in `public/css/styles.css` to display text labels (`MODE: DARK` / `MODE: LIGHT`) on desktop, and collapse to the `◐` icon button on viewport sizes `< 640px`.
5. **Retro LCD Carousel**: Refactored the graphical homepage banner in `src/views/index.ejs` and rewritten `public/js/carousel.js` logic to implement a 150px tall, compact text-based LCD panel. Styled it with a double border, scanline overlay effects, and theme-responsive neon text colors.
6. **Autoplay and Navigation**: Wires auto-advancing slides and manual controls (arrow links and indicator dots) targeting `/products`, `/aboutUs`, and a `#` quote placeholder.

All 16 tasks were completed. 30/30 tests pass. All spec scenarios are fully compliant.

---

## 2. Spec Sync

The delta specs from the active change folder have been merged into the main specifications:

| Capability | Source | Destination | Status |
|---|---|---|---|
| pixel-art-identity | `openspec/changes/theme-and-carousel/specs/pixel-art-identity/spec.md` | `openspec/specs/pixel-art-identity/spec.md` | Merged and updated (light theme and FOUC prevention details added) |
| dynamic-homepage | `openspec/changes/theme-and-carousel/specs/dynamic-homepage/spec.md` | `openspec/specs/dynamic-homepage/spec.md` | Merged and updated (compact LCD text carousel details added) |

### Merge Details

- **pixel-art-identity**:
  - Appended the `Flash of Unstyled Content (FOUC) Prevention` requirement and its `Saved theme applied before render` scenario to the main spec.
  - Modified the `PICO-8 Design System Custom Properties` requirement to specify light theme custom property mappings (`--bg`, `--fg`, `--accent`, `--surface`) and added the `Light theme active` scenario.
  - Modified `Header and Footer Pixel Art Styling` requirement to mandate the theme toggle button in the header, its text labels, local storage caching, and its collapsed responsive layout on mobile screens (`< 640px`) with scenarios.
- **dynamic-homepage**:
  - Replaced the previous graphical `Carousel with Linked Slides` requirement and scenarios with the compact retro LCD text carousel spec, detailing the 3 slide messages, the 150px fixed height, and double border and scanline styles.

---

## 3. Verification Summary

- **Tasks**: 16/16 complete (100% checked in `tasks.md`)
- **Tests**: 30/30 passing across 6 Jest suites (added `theme.test.js` to cover active toggling and class manipulation)
- **Spec compliance**: 10/10 scenarios COMPLIANT
- **Static evidence checks**: 11/11 PASS
- **Design coherence**: 3/3 decisions followed
- **Critical issues**: 0
- **Warnings**: 0
- **Suggestions**: 1

### Suggestions Documented

**S1 — Third Carousel Slide Link Target**
- **Symptom**: The third LCD slide ("Pedí tu cotización") points to the `#` page anchor.
- **Reason**: Currently, Mundo-3D has no dedicated contact or quote request route.
- **Recommendation**: Once a contact page is introduced, update the third slide's anchor tag to target the new route (e.g. `/contact` or `/quote`).

---

## 4. Files Changed

### New Files
- `public/js/theme.js` — manages theme toggle click events, storage syncing, and header label changes.
- `src/__tests__/theme.test.js` — Jest tests validating DOM/attributes changes on theme toggle button click.

### Modified Files
- `public/css/styles.css` — added breakpoint variables, light theme properties, toggle header layout, and LCD carousel double-border/scanline styling.
- `src/views/partials/head.ejs` — injected inline synchronous theme script to prevent FOUC.
- `src/views/partials/header.ejs` — added theme toggle button and imported `public/js/theme.js`.
- `src/views/index.ejs` — restructured EJS layout to support text slides inside the carousel.
- `public/js/carousel.js` — refactored script to handle text cycling, auto-advance interval, and manual controls.
- `openspec/specs/pixel-art-identity/spec.md` — updated with merged delta requirements.
- `openspec/specs/dynamic-homepage/spec.md` — updated with merged delta requirements.

---

## 5. Engram Traceability

| Artifact | Location | Type |
|---|---|---|
| proposal | `sdd/theme-and-carousel/proposal` | architecture |
| spec | `sdd/theme-and-carousel/spec` | architecture |
| design | `sdd/theme-and-carousel/design` | architecture |
| tasks | `sdd/theme-and-carousel/tasks` | architecture |
| verify-report | `sdd/theme-and-carousel/verify-report` | architecture |
| archive-report | `sdd/theme-and-carousel/archive-report` | architecture |

---

## 6. SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. The PICO-8 design system is now interactive with persistent dark/light states, and the dynamic homepage is enhanced with an active retro text panel carousel.
