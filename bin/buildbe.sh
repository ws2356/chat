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

if [ -n "${NVM_DIR:-}" ] ; then
  . "${NVM_DIR}/nvm.sh"
  nvm exec -- npm install --include dev
else
  npm install --include dev
fi
node_modules/.bin/tsc -p .
cp "${root_dir}/ormconfig.json" "${root_dir}/dist/ormconfig.json"

(cd "${root_dir}/dist/" && ln -sf "../bin/migrate.sh" .)

cp "${root_dir}/.env" "${root_dir}/dist/"
test -r "${root_dir}/.nvmrc" && cp "${root_dir}/.nvmrc" "${root_dir}/dist/"

