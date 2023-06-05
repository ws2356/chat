#!/bin/sh

set -eu

this_file="$0"
if ! [ -e "$this_file" ] ; then
  this_file="$(type -p "$this_file")"
fi
if ! [ -e "$this_file" ] ; then
  echo "Failed to resolve file."
  exit 1
fi
if [ "$(echo "$this_file" | cut -c 1)" != "/" ] ; then
  this_file="$(pwd)/$this_file"
fi
while [ -h "$this_file" ] ; do
  ls_res="$(ls -ld "$this_file")"
  link_target=$(expr "$ls_res" : '.*-> \(.*\)$')
  if [ "$(echo "$link_target" | cut -c 1)" = "/" ] ; then
    this_file="$link_target"
  else
    this_file="$(dirname "$this_file")/$link_target"
  fi
done
this_dir="$(dirname "$this_file")"
root_dir="${this_dir}/.."

fedir="${root_dir}/frontend"
cd "$fedir"
rm -rf build
if [ -n "${NVM_DIR:-}" ] ; then
  . "${NVM_DIR}/nvm.sh"
  nvm exec -- npm install --include dev
else
  npm install --include dev
fi
NODE_OPTIONS=--openssl-legacy-provider node_modules/.bin/webpack build
echo "done build fe"
