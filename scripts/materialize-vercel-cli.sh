#!/usr/bin/env bash

set -euo pipefail

source_root="${1:?trusted Vercel CLI source root is required}"
destination="${2:?Vercel CLI destination is required}"
github_output="${3:-}"
cli_label=Vercel
cli_package=vercel
expected_version=65.2.0
expected_lock_sha256="2144be1474b9cb5bf29ac7d059fbc251d506699a8dbe4555be9b9849bb206ccd"
expected_integrity="sha512-IPalObt3xnaY9Njbwb3wbQR7ht0gyL3XYt4z1wjFui3r5pkJPKSAGaGSD4B5AX5B4tOXxSbnXpWnKx+RJgdKrg=="
# Use Sandbox directly: Vercel's sandbox wrapper overwrites failed remote exits.
additional_bin=sandbox_cli=sandbox
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/materialize-pinned-cli.sh"
