#!/usr/bin/env bash
set -eu

declare -r url=http://localhost:8030?foo=bar


create_time=$(date '+%s')
MsgId=1686666227
echo "msgid: $MsgId"

xml_data=$(cat <<EOF
<xml>
  <ToUserName><![CDATA[mlgb-2356]]></ToUserName>
  <FromUserName><![CDATA[TestUser_openid]]></FromUserName>
  <CreateTime>$create_time</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[如何提高记忆力]]></Content>
  <MsgId>$MsgId</MsgId>
</xml>
EOF
)

curl "${url}/" -X POST \
  -H 'content-type: application/xml' \
  -d "${xml_data}"
