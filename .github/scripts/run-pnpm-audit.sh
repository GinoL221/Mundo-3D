#!/usr/bin/env bash
set -uo pipefail

output_file=$(mktemp)
trap 'rm -f "$output_file"' EXIT

if pnpm audit >"$output_file" 2>&1; then
  cat "$output_file"
  echo 'AUDIT_OK: pnpm audit completed without reported advisories.'
  exit 0
else
  status=$?
fi

cat "$output_file"

if grep -Eqi 'advisories|vulnerabilities|severity' "$output_file"; then
  echo 'AUDIT_ADVISORY: pnpm audit reported dependency advisories.' >&2
elif grep -Eqi 'ERR_PNPM_META_FETCH_FAIL|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|network|registry|fetch failed' "$output_file"; then
  echo 'AUDIT_AVAILABILITY_FAILURE: pnpm audit could not reach its registry or network dependency.' >&2
else
  echo 'AUDIT_EXECUTION_FAILURE: pnpm audit failed without an unambiguous advisory or availability signal.' >&2
fi

exit "$status"
