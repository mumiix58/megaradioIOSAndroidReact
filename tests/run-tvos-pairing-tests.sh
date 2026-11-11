#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
test_binary="$(mktemp -t megaradio-pairing-tests)"
trap 'rm -f "$test_binary"' EXIT
swiftc -swift-version 5 -parse-as-library \
  frontend/tvanddesktop/apple-tv-and-macos/ios-tvos/Models.swift \
  frontend/tvanddesktop/apple-tv-and-macos/ios-tvos/APIClient.swift \
  frontend/tvanddesktop/apple-tv-and-macos/ios-tvos/AuthStore.swift \
  tests/tvos_pairing_state_tests.swift -o "$test_binary"
"$test_binary"
