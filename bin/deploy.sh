#!/usr/bin/env bash

set -eu

is_release=false
while [ "$#" -gt 0 ] ; do
  case "$1" in
    -r|--release)
      is_release=true
        shift
        ;;
    *)
        shift
        ;;
  esac
done


this_file="${BASH_SOURCE[0]}"
if ! [ -e "$this_file" ] ; then
  this_file="$(type -p "$this_file")"
fi
if ! [ -e "$this_file" ] ; then
  echo "Failed to resolve file."
  exit 1
fi
if ! [[ "$this_file" =~ ^/ ]] ; then
  this_file="$(pwd)/$this_file"
fi
while [ -h "$this_file" ] ; do
  ls_res="$(ls -ld "$this_file")"
  link_target=$(expr "$ls_res" : '.*-> \(.*\)$')
  if [[ "$link_target" =~ ^/ ]] ; then
    this_file="$link_target"
  else
    this_file="$(dirname "$this_file")/$link_target"
  fi
done
this_dir="$(dirname "$this_file")"
root_dir="${this_dir}/.."

node_image=
get_node_image() {
  local dockerfile="${root_dir}/Dockerfile"

# find which version of node to use
  {
    while read -r line ; do
      if [[ "$line" =~ ^[[:blank:]]*FROM[[:blank:]]+(node[^[:space:]]+).*$ ]] ; then
        node_image="${BASH_REMATCH[1]}"
        break
      fi
    done
  } < "$dockerfile"

  if [ -z "${node_image}" ] ; then
    echo "Cannot determine node image"
    exit 1
  fi

  echo "Using node image: $node_image"
}

prepare_release() {
  docker pull "$node_image"
  # todo: use python to do this
  image_name_version="$(docker run --rm -v "${root_dir}/package.json:/package.json" "$node_image" \
    node -e 'const pkg = require("/package.json"); console.log(`${pkg.name}:${pkg.version}`);'
  )"

  container_name="$(echo "$image_name_version" | sed 's/:.\{0,\}//')"
  export image_name_version container_name

  echo "prepare ok，image: $image_name_version, container: $container_name"
}

prepare_dev() {
  docker pull "$node_image"

  container_name="$(docker run --rm -v "${root_dir}/package.json:/package.json" "$node_image" \
    node -e 'const pkg = require("/package.json"); console.log(`${pkg.name}`);'
  )"
  image_name_version="${container_name}:$(git rev-parse --verify --short=8 @)"
  export image_name_version container_name

  echo "prepare ok，image: $image_name_version, container: $container_name"
}

get_node_image
if $is_release ;  then
  prepare_release
else
  prepare_dev
fi

(rm -rf "$root_dir/public/fe" && \
  mkdir -p "$root_dir/public" && \
  cd "$root_dir/fe" && \
  npm run build && \
  mv build "$root_dir/public/fe")

docker container stop "$container_name" 2>/dev/null \
  && docker container rm "$container_name" 2>/dev/null \
  || true

docker rmi "$image_name_version" 2>/dev/null || true

port="${port:-8030}"

docker build -t "$image_name_version" \
  .
docker run -d \
  --restart always \
  --network sa-net \
  -p "${port}:8030" \
  --name "$container_name" \
  "$image_name_version"

