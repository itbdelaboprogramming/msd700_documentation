---
search: false
---

# Documentation

<RoleBadge role="developer" />

This section is for **developers** working on the MSD700 codebase (and this documentation site itself). If you're looking to use MSD700, see [Getting Started](/getting-started/). If you're installing hardware/software in the field, see [Setup](/setup/).

<LinkCards>
  <LinkCard icon="🏗️" title="Architecture" details="How the MSD700 Server and Unit fit together, with diagrams." link="/development/architecture" />
  <LinkCard icon="🔁" title="State and Behavior" details="Every state machine: activity, lease, watchdog tiers, autopilot, coverage, recovery." link="/development/state-and-behavior" />
  <LinkCard icon="📨" title="Message Contracts" details="Exact payloads on MQTT, the topic bridge, operation sync, and enrolment." link="/development/message-contracts" />
  <LinkCard icon="🔌" title="API Reference" details="Every endpoint, with request and response bodies." link="/development/api-reference" />
  <LinkCard icon="🗂️" title="Repository Structure" details="Layout of this repository and how the docs site is deployed." link="/development/repository-structure" />
  <LinkCard icon="🤝" title="Contributing" details="Dev workflow, commit conventions, and how to submit changes." link="/development/contributing" />
  <LinkCard icon="📝" title="Changelog" details="What changed and when." link="/development/changelog" />
</LinkCards>

## Reading order

If you are new to the codebase, these four pages are meant to be read in this order. Each one
assumes the previous.

1. [Architecture](/development/architecture): the two-machine model, the components, and the two
   independent channels between them.
2. [Message Contracts](/development/message-contracts): what actually travels on those channels,
   field by field.
3. [State and Behavior](/development/state-and-behavior): the state machines that produce and
   consume those messages, and the failure modes each one is guarding against.
4. [API Reference](/development/api-reference): the HTTP surface the dashboard drives it all with.
