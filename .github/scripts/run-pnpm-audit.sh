#!/usr/bin/env bash
#
# Two-tier dependency audit.
#
# The blocking gate covers the production tree only: that is the boundary the
# application actually ships, and it is the one a consumer of this repository
# is exposed to.
#
# The full tree is still reported, so a build or test tooling advisory stays
# visible instead of disappearing, but it never blocks. A gate that blocks on
# tooling advisories turns permanently red as soon as upstream publishes a
# finding whose fix is not released: there is then nothing this repository can
# change to make it green again, and an always-red check stops being read.
# Known unfixable tooling advisories are recorded in pnpm-workspace.yaml.
set -uo pipefail

production_file=$(mktemp)
development_file=$(mktemp)
trap 'rm -f "$production_file" "$development_file"' EXIT

classify() {
  local output_file="$1"

  if grep -Eqi 'advisories|vulnerabilities|severity' "$output_file"; then
    printf 'AUDIT_ADVISORY'
  elif grep -Eqi 'ERR_PNPM_META_FETCH_FAIL|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network|registry|fetch failed' "$output_file"; then
    printf 'AUDIT_AVAILABILITY_FAILURE'
  else
    printf 'AUDIT_EXECUTION_FAILURE'
  fi
}

# Temporary exception: GHSA-fc5q-39xc-vjpf (picomatch <= 4.0.7, first_patched_version null;
# 4.0.8 is not yet published on npm). Run the real production audit in JSON mode and allow
# exit non-zero ONLY when every reported production advisory is GHSA-fc5q-39xc-vjpf.
only_ignored_prod_advisories() {
  local output_file="$1"
  node -e '
    const fs = require("node:fs");
    const ALLOWED = new Set(["GHSA-fc5q-39xc-vjpf"]);
    try {
      const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      if (!data || typeof data !== "object" || !data.advisories || typeof data.advisories !== "object") {
        process.exit(1);
      }
      const entries = Object.values(data.advisories);
      if (entries.length === 0) {
        process.exit(1);
      }
      const allAllowed = entries.every(
        (entry) => entry && typeof entry.github_advisory_id === "string" && ALLOWED.has(entry.github_advisory_id)
      );
      if (!allAllowed) {
        process.exit(1);
      }
      const counts = data.metadata && data.metadata.vulnerabilities;
      if (counts && typeof counts === "object") {
        const total = Object.values(counts).reduce((sum, n) => sum + (typeof n === "number" ? n : 0), 0);
        if (total > entries.length) {
          process.exit(1);
        }
      }
      process.exit(0);
    } catch {
      process.exit(1);
    }
  ' "$output_file"
}

if pnpm audit --prod --json >"$production_file" 2>&1; then
  production_status=0
else
  production_status=$?
fi

cat "$production_file"

if [ "$production_status" -ne 0 ] && only_ignored_prod_advisories "$production_file"; then
  echo 'AUDIT_PROD_EXCEPTION: ignoring unpatched advisory GHSA-fc5q-39xc-vjpf in production tree (see pnpm-workspace.yaml).'
  production_status=0
fi

if pnpm audit >"$development_file" 2>&1; then
  development_status=0
else
  development_status=$?
fi

cat "$development_file"

if [ "$production_status" -ne 0 ]; then
  case "$(classify "$production_file")" in
    AUDIT_ADVISORY)
      echo 'AUDIT_ADVISORY: pnpm audit --prod reported a vulnerability in shipped dependencies.' >&2
      ;;
    AUDIT_AVAILABILITY_FAILURE)
      echo 'AUDIT_AVAILABILITY_FAILURE: the production audit could not reach its registry or network dependency.' >&2
      ;;
    *)
      echo 'AUDIT_EXECUTION_FAILURE: the production audit failed without an unambiguous advisory or availability signal.' >&2
      ;;
  esac
  exit "$production_status"
fi

if [ "$development_status" -ne 0 ]; then
  if [ "$(classify "$development_file")" = 'AUDIT_ADVISORY' ]; then
    echo 'AUDIT_DEV_TREE_ADVISORY: pnpm audit reported advisories outside the production tree; they are reported above and do not block. See pnpm-workspace.yaml for the recorded ones.'
  else
    echo 'AUDIT_DEV_TREE_UNAVAILABLE: the full-tree audit could not complete; the production gate above is unaffected.'
  fi
  exit 0
fi

echo 'AUDIT_OK: pnpm audit found no advisories in either the production or the development tree.'
