#!/usr/bin/env bash
set -eu

declare -r url="http://localhost:8030/message/${1:-0}"

curl "${url}/"
