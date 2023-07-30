## Onboarding 微信公众号
微信公众平台 https://mp.weixin.qq.com/

## Requesting access to OpenAI API
See doc: https://mp.weixin.qq.com/s/rIR8mnPlZusQfXHsZpL1CAo

## Architecture
[Sequence Diagram](architecture.plantuml)
### Edge cases
1. DNS resolution failure (EAI_AGAIN)

## Caveats
1. OpenAI permission is granted to your subscription. When that subscription is expired, you may need to submit an OpenAI application form again ...
2. How to avoid reaching token length limit?
3. Variable temperature.
4. Start a new thread.