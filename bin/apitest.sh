#!/usr/bin/env bash
set -eu

declare -r url=http://localhost:8030

create_time=$(date '+%s')
xml_data=$(cat <<EOF
<xml>
  <ToUserName><![CDATA[mlgb-2356]]></ToUserName>
  <FromUserName><![CDATA[TestUser_openid]]></FromUserName>
  <CreateTime>$create_time</CreateTime>
  <MsgType><![CDATA[text]]></MsgType>
  <Content><![CDATA[对于计算机专业本科毕业生，如何通过自学入门AI技术]]></Content>
  <MsgId>1686241185</MsgId>
</xml>
EOF
)

curl "${url}/" -X POST \
  -H 'content-type: application/xml' \
  -d "${xml_data}"
