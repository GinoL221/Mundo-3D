## Linked issue

Use one issue reference:

- `Closes #<number>` or `Fixes #<number>` when this PR completes the issue.
- `Refs #<number>` when the issue is related but is not completed by this PR.

The linked issue must already have the `status:approved` label. Do not apply or assume that approval yourself.

## PR type

Select exactly one category and apply its matching label:

- [ ] Bug fix — `type:bug`
- [ ] Feature — `type:feature`
- [ ] Refactor — `type:refactor`
- [ ] Maintenance/tooling — `type:chore`
- [ ] Documentation — `type:docs`

## Summary

- Describe the change.

## Changes

| File           | Change               |
| -------------- | -------------------- |
| `path/to/file` | Describe the change. |

## Test plan

List the actual commands and outcomes. Include manual verification when applicable; explain any failed, skipped, or unavailable checks.

- `command` — result

## Contributor checklist

- [ ] The linked issue is approved (`status:approved`).
- [ ] Exactly one matching `type:*` label is applied.
- [ ] Tests and functional checks are listed with their actual outcomes; skipped checks are explained.
- [ ] Documentation is updated when behavior or usage changes.
- [ ] Commit messages follow Conventional Commits and contain no AI attribution.
- [ ] No secrets or credentials are included.
