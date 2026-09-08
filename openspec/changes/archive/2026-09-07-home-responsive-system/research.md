# Research: home-responsive-system

schema: gentle-ai.sdd-research/v1
revision: 1
status: done
change: home-responsive-system
accessed_at: 2026-09-06

## Executive Summary

External evidence supports responsive behavior driven by available content and layout fit rather than universal device labels or universal numeric breakpoints. The accessibility evidence supports a native disclosure/navigation pattern with keyboard-operable controls, synchronized `aria-expanded` state, an `aria-controls` relationship, Escape handling, focus restoration, and a deliberate target-size policy; it does not select the product's exact menu modality or dimensions. Astro and Playwright documentation supports building the static site, previewing the deploy-ready output, controlling Chromium viewports, taking deterministic screenshot baselines, and asserting DOM-level overflow conditions.

This research is complete, but it does not confirm product decisions. Proposal admission still requires the unresolved decisions recorded in `exploration.md` and the additional decisions listed below to be confirmed by the orchestrator/user.

## Research Request

1. Establish evidence for responsive breakpoint strategy and content-fit thresholds without asserting universal numeric breakpoints.
2. Establish accessible responsive navigation/disclosure guidance for keyboard operation, focus restoration, Escape, `aria-expanded`, `aria-controls`, touch targets, and mobile-menu semantics.
3. Establish a practical viewport and visual-regression validation strategy for a static Astro + Playwright/Chromium Home page, including boundary widths and horizontal-overflow checks.

## Capability Admission

- Capability: `gentle-ai.sdd-research-capability/v1`
- Declared grants: `documentation`, `open-web`
- Observed grants: `documentation`, `open-web`
- Admission: accepted for both requested source classes
- Documentation evidence channel: official Astro and Playwright documentation retrieved through the documentation capability
- Open-web evidence channel: W3C/WAI, MDN, and web.dev pages retrieved through the open-web capability
- No evidence claims were inferred from Bash, persistence access, filenames, or unnamed tools.

## Validated Claims

### Lane 1 — Responsive breakpoints and content fit

#### R1. Breakpoints should be introduced when content needs a layout change, not because a named device class was reached

- Classification: recommendation
- Supported claim: web.dev explicitly says not to define breakpoints based on device classes, brands, operating systems, or products; it recommends letting content determine when the layout changes and starting small, then expanding until a breakpoint becomes necessary.
- Source IDs: `S1`

#### R2. Responsive layouts should accommodate unknown sizes with flexible layout primitives; fixed-width pages can create horizontal scrolling on narrow viewports

- Classification: guidance
- Supported claim: MDN describes responsive design as adapting across the full range of device sizes, warns that fixed-width pages create scrollbars on narrow devices and excess space on wide screens, and recommends flexible grids and relative units. MDN also describes breakpoints as points where the layout changes and recommends relative units rather than absolute sizes of an individual device.
- Source IDs: `S2`

#### R3. Numeric breakpoint values are examples or local implementation parameters, not universal standards

- Classification: evidence boundary
- Supported claim: the sources provide illustrative values such as `600px`, `575px`, and `700px` while simultaneously advising that breakpoints be chosen from content fit. No source reviewed establishes `640px`, `768px`, `960px`, `1024px`, or any other value as universally correct for this Home page.
- Source IDs: `S1`, `S2`

#### R4. The current change's candidate thresholds must be validated as content-fit boundaries

- Classification: local project decision, not an external requirement
- Supported claim: the exploration's `640px` grid boundary, `959px/960px` compact-navigation boundary, `<=360px` wordmark safeguard, and any wide-content cap are valid hypotheses to test, but external evidence does not confirm them. The implementation should measure whether the Home header, wordmark, navigation, cards, and copy remain usable at and around each boundary.
- Source IDs: `S1`, `S2`

### Lane 2 — Accessible responsive navigation and disclosure

#### R5. A disclosure control must be keyboard operable, and native button semantics are the simplest fit

- Classification: WCAG requirement plus APG guidance
- Supported claim: WCAG 2.1.1 requires all functionality to be operable through a keyboard interface. The WAI-ARIA APG disclosure pattern specifies Enter and Space activation for a focused disclosure control and identifies the control as a button.
- Source IDs: `S3`, `S6`

#### R6. Disclosure state must be exposed through `aria-expanded`; `aria-controls` identifies the controlled region

- Classification: APG/ARIA guidance, not a claim that every navigation must use ARIA
- Supported claim: the APG disclosure pattern specifies `aria-expanded="true"` when the controlled content is visible and `false` when hidden, and lists `aria-controls` as the relationship from the button to the controlled content. MDN documents that a toggling button should expose its current expanded state and may reference the controlled widget with `aria-controls`.
- Source IDs: `S3`, `S9`, `S10`

#### R7. Ordinary site navigation should not be given the ARIA `menu` role merely because it is visually called a menu

- Classification: APG guidance
- Supported claim: the WAI-ARIA disclosure-navigation example explicitly uses navigation semantics and ordinary links without the `menu` role because typical site navigation does not need the complex widget keyboard behavior expected by the menu/menubar pattern.
- Source IDs: `S4`

#### R8. Escape and focus restoration are expected for the APG disclosure-navigation interaction

- Classification: APG guidance
- Supported claim: the APG disclosure-navigation example closes an open dropdown on Escape and returns focus to the controlling button. It also states that focus leaving the navigation region closes the open dropdown in that example.
- Source IDs: `S4`

#### R9. A modal drawer is a different semantic model and must not be labelled modal unless it behaves modally

- Classification: APG guidance
- Supported claim: the APG modal-dialog pattern requires Escape to close, a contained tab sequence, initial focus inside the dialog, and focus return to the invoking element on close. It warns that `aria-modal="true"` should be used only when all users are prevented from interacting with the outside content and the outside content is visually obscured.
- Source IDs: `S5`

#### R10. Target-size policy must distinguish conformance minimums from stricter product guidance

- Classification: WCAG requirements
- Supported claim: WCAG 2.2 SC 2.5.8 sets a Level AA minimum of `24x24` CSS pixels for pointer targets, with exceptions including sufficient spacing. SC 2.5.5 sets a stricter Level AAA target of `44x44` CSS pixels, also with exceptions. Therefore, `44x44` is a defensible stricter project target, but it must not be described as the universal WCAG AA requirement.
- Source IDs: `S7`, `S8`

### Lane 3 — Astro + Playwright/Chromium responsive validation

#### R11. The static page can be tested against the built output rather than only the development source server

- Classification: official tool guidance
- Supported claim: Astro documents `output: 'static'` for static output, `astro build` for compiling static assets, and `astro preview` for serving the output generated by the build for local inspection before deployment. Playwright documents its `webServer` configuration for starting a local server before tests and its `baseURL` support for relative navigation.
- Source IDs: `S11`, `S15`

#### R12. Playwright can exercise exact viewport boundary cases in Chromium

- Classification: official tool capability
- Supported claim: Playwright supports project-level and test-level viewport configuration, `page.setViewportSize()` for an individual page, and device/viewport emulation. This supports a matrix of exact widths and heights rather than relying only on named device presets.
- Source IDs: `S12`

#### R13. Visual regression can use screenshot baselines, but baselines require a controlled rendering environment

- Classification: official tool guidance
- Supported claim: Playwright's `expect(page).toHaveScreenshot()` creates a reference screenshot on the first run and compares subsequent runs against it. Playwright warns that rendering can vary by operating system, browser version, settings, hardware, power source, and headless mode; baselines should therefore be generated and evaluated in the same controlled environment.
- Source IDs: `S13`

#### R14. Horizontal overflow can be asserted directly in the browser

- Classification: implementation recommendation supported by platform/tool documentation
- Supported claim: Playwright's `page.evaluate()` can execute a DOM expression in the browser page and return its result. MDN defines root `clientWidth` as the viewport width excluding the scrollbar and `scrollWidth` as the width needed to contain all content without a horizontal scrollbar; MDN's overflow example compares `scrollWidth` and `clientWidth`. A practical Home assertion is therefore `document.documentElement.scrollWidth <= document.documentElement.clientWidth` after the page settles.
- Source IDs: `S14`, `S16`, `S17`

#### R15. Boundary tests should combine behavioral assertions, visual checks, and overflow checks

- Classification: local validation strategy informed by external evidence
- Supported claim: external sources support exact viewport control, screenshot comparison, and DOM evaluation, while the responsive-design sources support testing the widths at which content-fit changes are expected. Combining these checks is a project validation strategy, not a W3C or Playwright conformance requirement.
- Source IDs: `S1`, `S12`, `S13`, `S14`, `S16`, `S17`

## Recommended Evidence-Based Validation Matrix

The following widths are test fixtures derived from the current exploration and its local hypotheses. They are not universal breakpoint recommendations.

| Fixture                   | Purpose                                              | Minimum checks                                                                                                                       |
| ------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `320x800`                 | Smallest content-fit and wordmark safeguard          | No horizontal overflow; wordmark/media uncropped; compact disclosure remains operable; screenshot after stable content               |
| `360x800`                 | Existing wordmark fallback boundary                  | Compare both sides of the `<=360px` local safeguard; verify readable labels and target sizes                                         |
| `375x812`                 | Representative phone viewport                        | Compact navigation; keyboard-equivalent control semantics; one-column content; screenshot and overflow                               |
| `639x900` and `640x900`   | Candidate phone/tablet grid boundary                 | Compare card count, card minimum fit, gutters, and header mode; do not assume the boundary is correct until content fit is confirmed |
| `768x1024`                | Tablet portrait                                      | Compact disclosure behavior, two-column candidate grid, no clipped wordmark/media, no overflow                                       |
| `959x768` and `960x768`   | Existing JavaScript/CSS navigation contract boundary | Verify compact-to-exposed navigation transition, `aria-expanded` synchronization, focus restoration, and screenshot differences      |
| `1024x768`                | Tablet landscape candidate                           | Verify orientation-independent behavior and card fit; do not equate the viewport with a device label                                 |
| `1279x900` and `1280x900` | Optional wide-content-cap boundary                   | Only include if a wide cap becomes a confirmed local decision; verify max-width and whitespace behavior                              |
| `1440x900`                | Wide desktop                                         | Exposed navigation, capped content frame, no excessive line length, screenshot baseline, and overflow                                |

For each fixture, run at least these checks:

1. Navigate to the built/previewed Home page with deterministic product data.
2. Assert the expected navigation mode and visible/hidden state.
3. Exercise the disclosure with keyboard input: focus the button, press Enter or Space, inspect `aria-expanded`, verify the referenced controlled region, press Escape, and verify focus restoration to the invoker.
4. Assert the root overflow condition with `scrollWidth <= clientWidth`.
5. Capture the stable visual baseline for the intended state. If dynamic product loading or animation affects pixels, wait for a deterministic settled state or use a narrowly scoped screenshot stylesheet rather than weakening the whole comparison.
6. Run the matrix in the same Chromium/OS/rendering environment used to create its baselines.

## Contradictions and Boundary Conditions

1. **Illustrative numeric examples vs. non-universal values:** MDN and web.dev use numeric examples (`600px`, `575px`, `700px`) while also recommending content-driven decisions. These are compatible: the numbers illustrate mechanics, not a universal design system. No source validates the Home page's exact `640px` or `960px` values.
2. **Disclosure navigation vs. modal drawer:** the disclosure-navigation example returns focus on Escape without requiring modal-dialog semantics; the modal-dialog pattern additionally requires a contained tab sequence and inert/obscured outside content. The implementation must choose one interaction model and meet that model's behavior rather than combining partial semantics.
3. **WCAG AA vs. AAA target sizes:** `24x24` CSS pixels is the SC 2.5.8 Level AA minimum, while `44x44` is the SC 2.5.5 Level AAA target. A local `44x44` policy is stricter guidance, not a universal AA requirement.
4. **Visual stability vs. visual coverage:** Playwright supports screenshots, but its own documentation warns about host-dependent rendering. A single baseline set cannot be treated as browser/OS-independent proof without controlling the rendering environment.

## Uncertainty and Freshness

- `S1` (web.dev) is useful and directly on point for content-driven breakpoints, but the page reports a last update of 2019-02-12. Treat it as durable guidance, not a current normative standard.
- `S2` (MDN Responsive Design) reports a 2026-09-04 update and is current for the concepts cited here.
- `S3` and `S4` are WAI-ARIA APG guidance/examples, not standalone WCAG conformance tests. `S4` explicitly warns that its code is illustrative and should be tested with assistive technologies before production use.
- `S5` is applicable only if the mobile navigation is implemented as a modal dialog/drawer. It does not require a normal non-modal disclosure to become a dialog.
- `S7` and `S8` are WCAG 2.2 Understanding documents, which explain the success criteria; the normative criteria are linked from those pages.
- `S9` and `S10` describe ARIA relationships but do not by themselves prove that a particular markup structure is accessible in all browser and assistive-technology combinations.
- `S11` reflects current official Astro documentation for static output/build/preview. The local project must still verify its own Astro configuration and preview command during implementation.
- `S13` warns that screenshot rendering differs across environments. Baseline identity is therefore a project-controlled test concern, not an intrinsic guarantee of Playwright.
- No source reviewed provides a universal numeric breakpoint, confirms the Home page's exact grid threshold, chooses modal vs. non-modal navigation, or selects the project's screenshot diff tolerance.

## Product Choices — Non-Authoritative and Unresolved

Research informs these decisions but does not make them:

1. Confirm whether `640px` remains the two-column grid transition, or whether card minimum width/content fit moves the transition.
2. Confirm whether exposed navigation begins at `960px`, or only when the header's actual content fit proves it can remain one row; keep the JavaScript and CSS boundary aligned.
3. Choose the mobile navigation interaction model: a non-modal disclosure navigation, or a modal drawer with full dialog behavior and inert outside content.
4. Confirm the local touch-target policy: WCAG AA minimum (`24x24` with spacing exceptions), a stricter `44x44` target, or another documented project target.
5. Confirm whether `aria-controls` is always emitted for the compact menu and whether the controlled region uses a stable ID across Astro rendering and client hydration.
6. Confirm the visual-validation scope: behavioral assertions only, screenshot baselines, or both; if screenshots are used, confirm the baseline OS/browser/container and allowed diff policy.
7. Confirm the final boundary matrix, including `320`, `360`, `375`, `639/640`, `768x1024`, `959/960`, `1024x768`, and any wide-content-cap boundary.
8. Confirm how deterministic product hydration, image loading, theme state, and motion are controlled before screenshot capture.

## Source Register

All sources were accessed on 2026-09-06.

| ID    | Class                           | Title                                           | Publisher                                    | URL                                                                                                               | Exact claim supported                                                                                                                                                                                  |
| ----- | ------------------------------- | ----------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `S1`  | open-web guidance               | Responsive web design basics                    | web.dev / Google Chrome team                 | <https://web.dev/articles/responsive-web-design-basics>                                                           | Do not define breakpoints by device classes; let content determine layout changes; start small and expand until a breakpoint is necessary; users generally scroll vertically rather than horizontally. |
| `S2`  | open-web documentation          | Responsive web design                           | MDN Web Docs                                 | <https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/CSS_layout/Responsive_Design>                | Responsive design adapts across device sizes; fixed widths can cause scrollbars; breakpoints are layout-change points; relative units and flexible grids are preferred over individual-device sizes.   |
| `S3`  | open-web accessibility guidance | Disclosure (Show/Hide) Pattern                  | WAI-ARIA Authoring Practices Guide / W3C WAI | <https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/>                                                            | Disclosure controls use button semantics, Enter/Space activation, `aria-expanded`, and optionally `aria-controls`.                                                                                     |
| `S4`  | open-web accessibility guidance | Example Disclosure Navigation Menu              | WAI-ARIA Authoring Practices Guide / W3C WAI | <https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/>                             | Typical site navigation should not use the ARIA `menu` role; the example documents Escape close, focus return, navigation semantics, and `aria-expanded`/`aria-controls`.                              |
| `S5`  | open-web accessibility guidance | Dialog (Modal) Pattern                          | WAI-ARIA Authoring Practices Guide / W3C WAI | <https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/>                                                          | Modal dialogs require Escape close, contained tab navigation, initial focus inside, focus return to the invoker, and genuine modal/inert behavior before using `aria-modal="true"`.                    |
| `S6`  | open-web standard guidance      | Understanding SC 2.1.1: Keyboard                | W3C WAI / WCAG 2.2                           | <https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html>                                                       | All functionality must be operable through a keyboard interface.                                                                                                                                       |
| `S7`  | open-web standard guidance      | Understanding SC 2.5.8: Target Size (Minimum)   | W3C WAI / WCAG 2.2                           | <https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html>                                            | Level AA target-size minimum is `24x24` CSS pixels, with spacing and other exceptions.                                                                                                                 |
| `S8`  | open-web standard guidance      | Understanding SC 2.5.5: Target Size (Enhanced)  | W3C WAI / WCAG 2.2                           | <https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html>                                           | Level AAA enhanced target size is `44x44` CSS pixels, with exceptions; it is stricter than the AA minimum.                                                                                             |
| `S9`  | open-web documentation          | ARIA: aria-expanded attribute                   | MDN Web Docs                                 | <https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-expanded>              | A focusable control that toggles a widget should expose its current expanded/collapsed state; a button can pair `aria-expanded` with `aria-controls`.                                                  |
| `S10` | open-web documentation          | ARIA: aria-controls attribute                   | MDN Web Docs                                 | <https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-controls>              | `aria-controls` identifies the element whose contents or presence is controlled by the interactive element.                                                                                            |
| `S11` | documentation                   | Configuration Reference; Deploy your Astro Site | Astro official documentation                 | <https://docs.astro.build/en/reference/configuration-reference/> and <https://docs.astro.build/en/guides/deploy/> | Astro supports static output, `astro build`, and previewing the build output locally before deployment.                                                                                                |
| `S12` | documentation                   | Emulation                                       | Playwright official documentation            | <https://playwright.dev/docs/emulation>                                                                           | Playwright supports exact project/test/page viewport sizes and device/viewport emulation.                                                                                                              |
| `S13` | documentation                   | Visual comparisons                              | Playwright official documentation            | <https://playwright.dev/docs/test-snapshots>                                                                      | `toHaveScreenshot()` compares screenshots against baselines; rendering environment consistency matters.                                                                                                |
| `S14` | documentation                   | Evaluating JavaScript                           | Playwright official documentation            | <https://playwright.dev/docs/evaluating>                                                                          | `page.evaluate()` runs a function in the browser page and returns its result to the test.                                                                                                              |
| `S15` | documentation                   | Web server                                      | Playwright official documentation            | <https://playwright.dev/docs/test-webserver>                                                                      | Playwright can start a local server before tests and use a configured `baseURL`.                                                                                                                       |
| `S16` | open-web documentation          | Element: scrollWidth property                   | MDN Web Docs                                 | <https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollWidth>                                            | `scrollWidth` measures content width including content hidden by overflow and equals `clientWidth` when no horizontal scrollbar is needed.                                                             |
| `S17` | open-web documentation          | Element: clientWidth property                   | MDN Web Docs                                 | <https://developer.mozilla.org/en-US/docs/Web/API/Element/clientWidth>                                            | Root `clientWidth` returns viewport width excluding the scrollbar, enabling a root overflow comparison.                                                                                                |

## Proposal Readiness

- Evidence outcome: `done`
- Evidence claims: fully mapped to source IDs
- Evidence validity: valid for the three requested lanes, with freshness and applicability limits recorded
- Product decisions: `pending`
- Proposal readiness: `false` until the orchestrator confirms the unresolved product decisions
