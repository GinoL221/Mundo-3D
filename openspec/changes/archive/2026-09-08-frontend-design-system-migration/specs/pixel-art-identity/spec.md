# Delta for Pixel Art Identity

## MODIFIED Requirements

### Requirement: Scoped Image Rendering Rules

Real product imagery and approved brand imagery MUST use normal browser image rendering and MUST NOT be globally pixelated, reconstructed, recolored, filtered, or otherwise altered by the shared contract. Intentional pixel-art placeholders MAY retain pixelated rendering only through an explicit, isolated semantic marker. Existing square geometry and legacy typography rules MAY remain for known legacy consumers through the compatibility mapping, but Wave 0 MUST NOT promote PICO-8, CRT/JRPG, pixel-font, orange/crimson, shadow, gradient, or glow treatments into shared authority.

(Previously: Pixelated rendering, square geometry, and the Press Start 2P / VT323 font stack applied globally to all pages and images.)

#### Scenario: Real product or brand imagery renders normally

- GIVEN an image is approved product photography, a product image, or an approved brand asset
- WHEN the shared and legacy styles are computed
- THEN its image rendering MUST be normal
- AND the shared contract MUST NOT recolor, filter, reconstruct, or pixelate it

#### Scenario: Intentional pixel art remains isolated

- GIVEN an image is an intentional pixel-art placeholder
- WHEN it carries the explicit pixel-art semantic marker
- THEN it MAY use pixelated rendering
- AND removing that marker MUST restore normal rendering

#### Scenario: Legacy geometry and typography remain compatible

- GIVEN a known legacy consumer depends on square geometry or legacy font treatment
- WHEN Wave 0 is applied
- THEN its compatibility mapping MUST preserve the consumer's existing behavior
- AND those treatments MUST NOT be classified as shared semantic foundations
