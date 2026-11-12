# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

The integration stores one file under `/data`: the last alert level and
aviation color code seen for each monitored volcano (public data), so a restart
fires no scene trigger. It holds no secret and asks for no account. It reads the
location of the house from Gladys (or coordinates typed in the configuration)
to compute distances, and never sends it anywhere nor writes it to the logs.
Its only network traffic is HTTPS requests to `volcanoes.usgs.gov`.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the USGS services the integration reads.
