---
outline: deep
search: false
---

# Map Sync & Auto Align

<RoleBadge role="developer" />

The Navigation page's answer to "the robot's dot on the map is not where the robot actually is."
Map Sync is a Mode List entry (`initial-pose` in `ModeListPanel.tsx`) that puts the canvas into
pose-correction mode while the robot stays stationary; Auto Align is a sub-feature offered only
inside that mode, which does the same correction without operator guesswork. For the rest of the
Mode List, see [Overview](/development/webui/navigation/overview); for the wire contract this page
only summarizes, see [ROS Integration](/development/webui/navigation/ros-integration).

::: info Scope
This page covers pose correction only: Map Sync and Auto Align. Coverage cleaning, pinpoint/route
driving, and manual/autopilot control are covered in their own pages under
[Related](#related). The coverage sweep algorithm itself (geometry, cellular decomposition,
obstacle handling) lives in
[Boustrophedon Coverage](/development/ros/boustrophedon-and-alignment), not here.
:::

## What pose correction solves

AMCL localizes the robot against a pre-recorded map, but that estimate can drift out of step with
where the robot physically is: after a manual push, a lift ride, a power cycle that lost the
in-memory pose, or a robot that was picked up entirely. Traditionally this is what AMCL's own
360-degree "spin in place to collapse particle dispersion" step is for, but the
[in-place rotation guard](/development/ros/boustrophedon-and-alignment#in-place-rotation-is-denied-by-default)
denies unattended spins by default, so the platform needs an operator-facing way to correct the
pose without relying on that motion.

Map Sync mode is that surface. Selecting it (`Map Sync` in the Mode List, which relabels to
`Finish Map Sync` while active) toggles the underlying map canvas into an interactive
pose-correction state; leaving it restores the normal Navigation canvas.

## Auto Align

Auto Align is a button shown only while Map Sync mode is active. It replaces "the operator manually
drags the robot icon to the right spot and orientation" with a single click: the robot's live LiDAR
scan is matched against the loaded map by a stationary scan matcher, and the resulting pose is
written straight to AMCL, with no rotation and no translation. This is the same zero-spin
Correlative Scan Matching (CSM) algorithm documented in full in
[Boustrophedon Coverage & Zero-Spin Alignment Architecture](/development/ros/boustrophedon-and-alignment#zero-spin-orientation-alignment-correlative-scan-matching):
that page is the source of truth for the scoring function, the confidence threshold, and the
micro-jog fallback. This page only covers the button's own contract with the backend.

### `/api/autoalign/start`

`POST /api/autoalign/start` (documented in full in
[API Reference § Auto Align System](/development/api-reference#auto-align-system)) initiates the
scan-match. The frontend (`autoAlignApi.ts`, `postAutoAlign('start', { unit_id })`) disables the
button immediately and polls status rather than waiting on this call to report convergence, since
convergence is asynchronous on the robot side.

### `/api/autoalign/status`

Polled on a fixed interval while a run is in flight to ask whether the scan matcher has converged.
The frontend treats the run as aligned only when the response's convergence flag reads `true`, and
gives up after an upper-bound wait if it never does, surfacing that as "failed" rather than as an
error toast: nothing moved, so nothing needs to be recovered, and the operator can simply
re-trigger. Re-triggering is intentionally blocked only while a run is actually in flight, not
after it finishes or times out.

### `/api/autoalign/reset`

Clears the robot-side align run: it resets the aligner's internal active flag and returns the
robot's reported activity back to idle. The frontend calls this on **both** exit paths, a
converged run and a timed-out run alike, because the robot-side align state otherwise stays latched
as "active"/"auto_aligning" until explicitly cleared, which would otherwise be misread elsewhere as
a stuck robot. It is also called if the operator leaves Map Sync mode mid-run, to tell the robot to
stand down.

::: info Not documented in source
`api-reference.md` only documents `/api/autoalign/start`; the `status` and `reset` endpoints are
confirmed from the frontend transport layer (`autoAlignApi.ts`) and its call sites, not from the
REST reference. Their exact response shapes beyond the fields the frontend reads (a convergence
boolean under `details`/`error_details`, and a `success`/`msg` envelope) are not covered by the
current source material and are not guessed at here.
:::

## Consent: Auto Align is a rotation-guard trust source

Auto Align does not itself command any rotation: that is the entire point of using a scan matcher
instead of a spin. But it is still load-bearing for the platform's
[in-place rotation guard](/development/ros/boustrophedon-and-alignment#in-place-rotation-is-denied-by-default),
which denies every in-place rotation unless it is accompanied by a live command on one of two
consent topics, and Auto Align's own internal checker (`align_checker`) is one of the two (the
other being manual WASD). Concretely, this means:

- If some other part of the stack ever tries to spin the robot in place to help localization
  (rather than calling Auto Align), the rotation guard will zero it out, because that command does
  not arrive on `/mux/allign`.
- Pressing the Auto Align button is, from the rotation guard's point of view, the only
  operator-initiated way to authorize an in-place rotation for localization purposes, and in the
  current design it never needs to, since CSM alignment is zero-motion by construction.

This page states the link because it is a genuine UI-to-ROS integration point: the button an
operator presses in Map Sync mode is named, by the guard, as a trusted consent source. The guard's
full gating logic (the geometry gate, the tolerance window, what got turned off) is documented in
[Boustrophedon Coverage & Zero-Spin Alignment Architecture](/development/ros/boustrophedon-and-alignment#in-place-rotation-is-denied-by-default)
and is not repeated here.

## Related

- [Overview](/development/webui/navigation/overview): the Navigation page and its full Mode List.
- [Coverage Cleaning](/development/webui/navigation/coverage-cleaning): the other stationary-start,
  autonomous-run feature on this page.
- [Pinpoint & Routes](/development/webui/navigation/pinpoint-and-routes): single/multi pinpoint
  driving and saved routes.
- [Manual & Autopilot](/development/webui/navigation/manual-and-autopilot): teleop and the
  autopilot sequencer.
- [ROS Integration](/development/webui/navigation/ros-integration): the full Navigation wire
  contract, including the Auto Align REST calls in context with the rest of the feature.
- [Boustrophedon Coverage & Zero-Spin Alignment Architecture](/development/ros/boustrophedon-and-alignment):
  the CSM algorithm and the in-place rotation guard.
- [Message Contracts](/development/message-contracts): the full MQTT command/feedback reference.
- [API Reference](/development/api-reference): the full REST API reference.
- [WebSocket and rosbridge Protocol](/development/rosbridge-protocol): the full rosbridge wire
  protocol.
