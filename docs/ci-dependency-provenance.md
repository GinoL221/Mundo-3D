# CI dependency provenance

This record is the review input for immutable CI dependencies. Renovate may propose updates, but it is configured never to merge them; a maintainer must verify the publisher, exact value, evidence, and platform intent in the PR.

**Retrieved:** 2026-09-18 UTC

## Approved GitHub Actions

All values retain the workflow's existing v4 major behavior. GitHub's official tag-ref API maps each named release tag to the listed complete commit, and the corresponding official GitHub commit API reports `verification.verified: true` with `reason: valid` and a PGP signature.

| Action                    | Intended release | Immutable commit                           | Official source and evidence                                                                                                                                                                                                                                       |
| ------------------------- | ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `actions/checkout`        | `v4.2.2`         | `11bd71901bbe5b1630ceea73d27597364c9af683` | [tag ref](https://api.github.com/repos/actions/checkout/git/ref/tags/v4.2.2), [verified commit](https://api.github.com/repos/actions/checkout/commits/11bd71901bbe5b1630ceea73d27597364c9af683)                                                                    |
| `pnpm/action-setup`       | `v4.1.0`         | `a7487c7e89a18df4991f7f222e4898a00d66ddda` | [signed annotated tag](https://api.github.com/repos/pnpm/action-setup/git/tags/7088e561eb65bb68695d245aa206f005ef30921d) (valid PGP signature), [verified commit](https://api.github.com/repos/pnpm/action-setup/commits/a7487c7e89a18df4991f7f222e4898a00d66ddda) |
| `actions/setup-node`      | `v4.4.0`         | `49933ea5288caeca8642d1e84afbd3f7d6820020` | [tag ref](https://api.github.com/repos/actions/setup-node/git/ref/tags/v4.4.0), [verified commit](https://api.github.com/repos/actions/setup-node/commits/49933ea5288caeca8642d1e84afbd3f7d6820020)                                                                |
| `actions/cache`           | `v4.2.4`         | `0400d5f644dc74513175e3cd8d07132dd4860809` | [tag ref](https://api.github.com/repos/actions/cache/git/ref/tags/v4.2.4), [verified commit](https://api.github.com/repos/actions/cache/commits/0400d5f644dc74513175e3cd8d07132dd4860809)                                                                          |
| `actions/upload-artifact` | `v4.6.2`         | `ea165f8d65b6e75b540449e92b4886f43607fa02` | [tag ref](https://api.github.com/repos/actions/upload-artifact/git/ref/tags/v4.6.2), [verified commit](https://api.github.com/repos/actions/upload-artifact/commits/ea165f8d65b6e75b540449e92b4886f43607fa02)                                                      |

## Approved MySQL image

| Image intent                      | Immutable index digest                                                          | Platform intent and official evidence                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker Official Image `mysql:8.0` | `mysql@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b` | Docker Registry v2 OCI index for [`library/mysql:8.0`](https://registry-1.docker.io/v2/library/mysql/manifests/8.0), retrieved with `Accept: application/vnd.oci.image.index.v1+json`. This is a manifest-list/index digest, appropriate for GitHub-hosted Linux runners; its Linux/amd64 child was `sha256:62fb722c78b24245ddff1796a0fcee4a49cc5b87e0aaaf20c92d1da9e0a2497b` and identifies Docker Official Image source `docker-library/mysql`. |

## Update and review procedure

1. Renovate's official [`github-actions` manager](https://docs.renovatebot.com/modules/manager/github-actions/) is restricted to `.github/workflows/ci.yml`; it can propose Action and Docker image updates from that workflow.
2. Renovate's [`automerge`](https://docs.renovatebot.com/configuration-options/#automerge) setting is explicitly `false`, so every proposed update remains a PR for maintainer review.
3. Before approval, verify the official publisher, release/tag-to-commit or registry digest mapping, valid signature/provenance evidence, and (for MySQL) Linux runner manifest intent. Update this record in the same PR.
4. Roll back by reverting the focused workflow, source-record, and updater change to the previous approved immutable values. Never restore mutable tags or bypass the audit gate.
