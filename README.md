## Onboarding 微信公众号
微信公众平台 https://mp.weixin.qq.com/

## Requesting access to OpenAI API
See doc: https://mp.weixin.qq.com/s/rIR8mnPlZusQfXHsZpL1CAo

## Architecture
[Sequence Diagram](architecture.plantuml)

## Caveats
1. DNS resolution failure (EAI_AGAIN)
Catch the error and retry if error code is EAI_AGAIN.

2. OpenAI permission is granted to your subscription. When that subscription is expired, you may need to activate a new subscription and then submit an OpenAI application form for that subscription separately ...
https://learn.microsoft.com/en-us/azure/devtest/offer/troubleshoot-expired-removed-subscription#maintain-a-subscription-to-use-monthly-credits

3. How to avoid reaching token length limit?
Append chat history from latest to oldest while calculating the token length. Stop when the token length exceeds the limit.

4. Variable temperature.
First sentence of incoming message if matched by a regex pattern, then deemed as an option. One of the options is to set the temperature to be 0.

5. Start a new thread.
First sentence of incoming message if matched by a regex pattern, then deemed as an option. One of the options is to start a new thread.