# Image URL Resolution Specification

## Purpose

A single dual-format rendering rule, shared by every `<img>` consumer, that resolves the
`image` value to a working URL whether it is a newly-uploaded absolute bucket URL or a
legacy bare filename from seed data.

## Requirements

### Requirement: Dual-Format Image Resolution at Render Time

Every `<img>` consumer MUST use the `image` value directly as `src` when it is already an
absolute URL, and MUST fall back to the existing `/img/{products,users}/${image}`
relative-path construction when it is a bare filename. This rule applies at, at minimum, the
5 confirmed call sites: `ProductSearch.astro`, `pages/product.astro`, `pages/index.astro`,
`CartList.astro`, and `sessionUI.ts` (user avatars).

#### Scenario: Absolute bucket URL is used as-is

- GIVEN a product or user record whose `image` value is a full absolute URL
- WHEN any of the 5 confirmed `<img>` sites renders that record
- THEN the rendered `src` MUST equal the stored `image` value unchanged

#### Scenario: Bare filename falls back to the legacy relative path

- GIVEN a seed product or user record whose `image` value is a bare filename with no scheme
- WHEN any of the 5 confirmed `<img>` sites renders that record
- THEN the rendered `src` MUST be constructed as `/img/{products,users}/${image}`, matching
  current behavior

#### Scenario: Resolution rule is applied consistently across product and user assets

- GIVEN both a product image site (`ProductSearch.astro`, `pages/product.astro`,
  `pages/index.astro`, `CartList.astro`) and the user avatar site (`sessionUI.ts`)
- WHEN each renders its respective `image` value
- THEN both MUST apply the same absolute-vs-bare-filename decision rule
- AND neither MUST assume the value is exclusively one format or the other
