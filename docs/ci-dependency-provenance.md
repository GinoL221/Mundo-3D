# CI dependency provenance

This record is the review input for immutable CI dependencies. Renovate may propose updates, but it is configured never to merge them; a maintainer must verify the publisher, exact value, evidence, and platform intent in the PR.

**Retrieved:** Existing entries 2026-09-18 UTC; the four actions from PR #183 and `actions/cache` v6.1.0 verified 2026-10-25 UTC.

## Approved GitHub Actions

PR #183 migrated four workflow actions to Node 24, and PR #185 migrated `actions/cache`; this record lists the current immutable pins for all five actions.

GitHub's official tag-ref API maps each named release tag to the listed complete commit, and the corresponding official GitHub commit API reports `verification.verified: true` with `reason: valid` and a PGP signature.

| Action                    | Intended release | Immutable commit                           | Official source and evidence                                                                                                                                                                                                                                       |
| ------------------------- | ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `actions/checkout`        | `v5.1.0`         | `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` | [tag ref](https://api.github.com/repos/actions/checkout/git/ref/tags/v5.1.0), [verified commit](https://api.github.com/repos/actions/checkout/commits/fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09)                                                                    |
| `pnpm/action-setup`       | `v6.1.0`         | `ea17c68df8912ef543352723c149a84f56e3d413` | [tag ref](https://api.github.com/repos/pnpm/action-setup/git/ref/tags/v6.1.0), [verified commit](https://api.github.com/repos/pnpm/action-setup/commits/ea17c68df8912ef543352723c149a84f56e3d413) |
| `actions/setup-node`      | `v5.0.0`         | `a0853c24544627f65ddf259abe73b1d18a591444` | [tag ref](https://api.github.com/repos/actions/setup-node/git/ref/tags/v5.0.0), [verified commit](https://api.github.com/repos/actions/setup-node/commits/a0853c24544627f65ddf259abe73b1d18a591444)                                                                |
| `actions/cache`           | `v6.1.0`         | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | [tag ref](https://api.github.com/repos/actions/cache/git/ref/tags/v6.1.0), [verified commit](https://api.github.com/repos/actions/cache/commits/55cc8345863c7cc4c66a329aec7e433d2d1c52a9)                                                                          |
| `actions/upload-artifact` | `v6.0.0`         | `b7c566a772e6b6bfb58ed0dc250532a479d7789f` | [tag ref](https://api.github.com/repos/actions/upload-artifact/git/ref/tags/v6.0.0), [verified commit](https://api.github.com/repos/actions/upload-artifact/commits/b7c566a772e6b6bfb58ed0dc250532a479d7789f)                                                      |

## Approved MySQL image

| Image intent                      | Immutable index digest                                                          | Platform intent and official evidence                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker Official Image `mysql:8.0` | `mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b` | Docker Registry v2 OCI index for [`library/mysql:8.0`](https://registry-1.docker.io/v2/library/mysql/manifests/8.0), retrieved with `Accept: application/vnd.oci.image.index.v1+json`. This is a manifest-list/index digest, appropriate for GitHub-hosted Linux runners; its Linux/amd64 child was `sha256:62fb722c78b24245ddff1796a0fcee4a49cc5b87e0aaaf20c92d1da9e0a2497b` and identifies Docker Official Image source `docker-library/mysql`. |

## Update and review procedure

1. Renovate's official [`github-actions` manager](https://docs.renovatebot.com/modules/manager/github-actions/) is restricted to `.github/workflows/ci.yml`; it can propose Action and Docker image updates from that workflow.
2. Renovate's [`automerge`](https://docs.renovatebot.com/configuration-options/#automerge) setting is explicitly `false`, so every proposed update remains a PR for maintainer review.
3. Before approval, verify the official publisher, release/tag-to-commit or registry digest mapping, valid signature/provenance evidence, and (for MySQL) Linux runner manifest intent. Update this record in the same PR.
4. Roll back by reverting the focused workflow, source-record, and updater change to the previous approved immutable values. Never restore mutable tags or bypass the audit gate.
