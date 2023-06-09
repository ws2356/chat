#!/usr/bin/env bash
set -eu

declare -r url=http://localhost:8030


create_time=$(date '+%s')
MsgId=$create_time
echo "msgid: $MsgId"

xml_data=$(cat <<EOF
<xml>
  <ToUserName><![CDATA[mlgb-2356]]></ToUserName>
  <FromUserName><![CDATA[TestUser_openid]]></FromUserName>
  <CreateTime>$create_time</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[如何提高睡眠质量]]></Content>
  <MsgId>$MsgId</MsgId>
</xml>
EOF
)

curl "${url}/" -X POST \
  -H 'content-type: application/xml' \
  -d "${xml_data}"
