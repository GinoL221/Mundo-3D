# Delta for navbar-and-footer

## ADDED Requirements

### Requirement: Header Session and Navigation

The Header MUST preserve session visibility, identity, links, dropdowns, and visual-only search through selectors, storage, and events.

#### Scenario: Session state updates Header visibility

- GIVEN `token` and `user` represent a guest, user, or administrator
- WHEN Header loads or receives `storage` or `session-changed`
- THEN existing visibility, greeting, and avatar MUST reflect that state

#### Scenario: Header navigation remains unchanged

- GIVEN a page displays the Header
- WHEN a user follows a link, focuses/hover a dropdown, or activates search
- THEN navigation and dropdown behavior MUST remain unchanged; search MUST perform no action

### Requirement: Header Logout Transition

The keyboard-activatable Header logout MUST remove `token`/`user`, clear the cart, then navigate to `/login`.

#### Scenario: Authenticated user logs out

- GIVEN an authenticated user activates logout
- WHEN the transition runs
- THEN storage MUST precede cart clearing, which MUST precede `/login` navigation as guest
