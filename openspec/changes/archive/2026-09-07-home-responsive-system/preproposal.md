schema: gentle-ai.sdd-preproposal/v1
revision: 1
change: home-responsive-system
artifact_store: hybrid
exploration:
  outcome: done
  reference: openspec/changes/home-responsive-system/exploration.md
  engram_reference: sdd/home-responsive-system/explore
research:
  selected: true
  outcome: done
  reference: openspec/changes/home-responsive-system/research.md
  engram_reference: sdd/home-responsive-system/research
  requested_classes:
    - documentation
    - open-web
  lanes:
    - responsive breakpoint strategy based on content fit
    - accessible responsive navigation and disclosure
    - Astro + Playwright/Chromium viewport and visual regression validation
admission:
  capability: gentle-ai.sdd-research-capability/v1
  declared_grants:
    - documentation
    - open-web
  observed_grants:
    - documentation
    - open-web
  outcome: accepted
evidence:
  status: valid
  revision: 1
  openspec: openspec/changes/home-responsive-system/research.md
  engram: sdd/home-responsive-system/research
product_decisions: confirmed
confirmed_decisions:
  - "Grid: two columns at 640–1023px and three columns from 1024px, subject to card minimum-width validation"
  - "Content frame: shared 1104px maximum for Home header, content, and footer"
  - "Typography: 16px minimum body size, approximately 75ch maximum reading width, and bounded fluid headings"
  - "Navigation boundary: compact through 1023px and exposed horizontal navigation from 1024px, with CSS and JavaScript aligned"
  - "Tablet landscape: retain compact navigation through 1023px regardless of orientation"
  - "Interaction: non-modal disclosure navigation"
  - "Touch targets: 44px local product policy"
  - "ARIA: stable controlled-region ID and aria-controls relationship for the compact menu"
  - "Validation: behavioral assertions plus screenshot baselines"
  - "Screenshot environment: fixed local Chromium, controlled fonts and rendering settings"
  - "Boundary matrix: 320, 360, 375, 639/640, 768x1024, 820, 960, 1023/1024, 1279/1280, and 1440px"
  - "Deterministic state: controlled fixtures for screenshots; API integration tested separately; theme and motion explicitly fixed"
proposal_ready: true
