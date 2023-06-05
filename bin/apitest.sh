#!/usr/bin/env bash
set -eu

declare -r baseurl=https://auth.wansong.vip
declare -r loginurl=${baseurl}/api/login
declare -r verifyurl=${baseurl}/api/verify

declare -r tokenName='token-of-auth'

email=wansong2356@163.com
password=
echo "input password for email $email:"
read -r password || test -n "$password" || exit 1

jsonbody="$(printf '{"email":"%s","password":"%s"}' "$email" "$password")"
{
  token=
  line=
  while read -r line || [ -n "$line" ] ; do
    if [[ "$line" =~ token-of-auth[[:space:]]+([^[:space:]]+) ]] ; then
      token="${BASH_REMATCH[1]}"
      break
    fi
  done
} < <(curl -X POST -H 'content-type:application/json' -c - -d "$jsonbody" "$loginurl" 2>/dev/null)

echo "token: $token"

curl -i -H "cookie: ${tokenName}=$token" "$verifyurl"
