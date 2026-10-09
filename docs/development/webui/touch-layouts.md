---
outline: deep
search: false
---

# ROS Web UI: Phone & Tablet Layouts

<RoleBadge role="developer" />

The operator pages (login and unit list, Navigation, Mapping, Database, signup) have two touch
compositions besides the desktop one: a phone layout (portrait only) and a tablet layout (either
orientation). They reuse the desktop's page state, map component, robot connection and dialogs;
only the arrangement differs, so nothing on the wire changes. The admin console stays desktop
only. Desktop rendering is unchanged by the touch work and was checked pixel for pixel against the
previous build. For the operator view, see [Phones & Tablets](/user-guide/phones-and-tablets).

## Choosing the layout {#detection}

`DeviceGuard` (`src/components/device-guard/deviceGuard.tsx`) is the one place that decides what a
device is, from device traits rather than window size:

| Check | Result |
| --- | --- |
| `detectDesktop()`: `userAgentData.mobile`, a mobile or tablet user agent, iPadOS (Mac platform with more than one touch point), `pointer: coarse` together with `hover: none`, or a screen whose long edge is under 1024 px | Not a desktop: touch layout |
| `detectPhone()`, asked only for a non-desktop: the screen's short edge is under 600 CSS px (`PHONE_MAX_SHORT_EDGE`) | Phone; otherwise tablet |
| Route starts with `/admin` on a non-desktop | Desktop-only notice, app unmounted |
| Desktop with a window under `MIN_APP_WIDTH` x `MIN_APP_HEIGHT` (1400 x 720, overridable by `NEXT_PUBLIC_MIN_APP_WIDTH/HEIGHT`) | "Screen size not supported" overlay, app kept mounted |

A touchscreen laptop reports a fine pointer and hover from its trackpad, so it stays on the desktop
layout and gets touch through the [map gestures](/development/webui/navigation/overview#map-input).

The verdict reaches components through two contexts in `src/hooks/useMobileLayout.ts`:

- `useMobileLayout()`: true on phones **and** tablets. Every control that changes for touch (round
  buttons, joystick, cards instead of hover tooltips, folded Mode List) reads this one.
- `useTabletLayout()`: true on tablets only. Read by the few places that lay out the page
  (`MobileShell`, the login page, header widths).

Both are device traits, not window sizes, so a session never swaps composition halfway and
remounts the map or the camera stream. `MobileLayoutProvider` in `_app.tsx` gives the same answer
to what renders outside `DeviceGuard` (the global unit status badge).

Until the first measurement, `DeviceGuard` renders only the page background. It used to render the
app straight away, but the composition is unknown before measuring, and rendering the wrong one
first would mount the robot connection, the map and the camera twice. Server and first client frame
both render the background, so hydration still matches.

A phone held in landscape keeps the app mounted under a "Turn your phone upright" panel, the same
way the small-window overlay works on a desktop: turning the phone mid-run must not drop the
session.

## Page composition {#composition}

Each operator page branches once, `isMobile ? <MobileShell …> : <desktop JSX>`, and passes the same
children to both. Leaf components take a `compact` prop or read `useMobileLayout()` themselves.

`MobileShell` (`src/components/mobile/MobileShell.tsx`), phone layout from top to bottom:

| Part | Content |
| --- | --- |
| Header bar | Logo, welcome pill (name and unit, truncated to fit 360 px), close button |
| Feature row | Current page pill (opens the menu sheet), `RobotConnectionStatus compact` |
| Main panel | `children`: the map, or the map list on Database |
| Drive bar slot | `#mobile-drive-bar`, empty unless Manual Override is on |
| Camera row | `camera` prop plus the `#mobile-drive-pad` slot |
| Bottom bar | Menu, Camera (Half / Full), page `bottomActions`, Instructions, copyright |
| Menu sheet | Page switcher and `menuExtra` (Robot Control on Navigation and Mapping) |

`RobotConnectionStatus` is mounted on every operating page, Database included: it is the robot
ping and heartbeat and owns the connection-lost and takeover dialogs, not just the LiDAR indicator.

The menu sheet and the camera are **hidden, never unmounted**. Robot Control inside the sheet keeps
its state and its robot subscriptions while the operator looks at the map, and hiding the camera
does not tear down the WebRTC stream and force a fresh negotiation on every toggle.

`TabletShell` builds the tablet layout from the same parts: page tabs (`FeatureTabs`) instead of
the menu sheet, the status pill in the header, and a side column holding the camera and
`menuExtra`. The column is on the left in landscape and under the map in portrait, switched by
Tailwind `landscape:` and `portrait:` classes only, so rotating never remounts anything.

### Moved parts {#moved-parts}

Things the desktop shows in fixed places that a phone has no room for move as follows:

| Desktop | Touch layouts |
| --- | --- |
| Overview minimap in the map's top-left corner | Portalled into `#mobile-preview-slot` in `MobileCameraPanel`, behind a Camera / Preview toggle (Navigation) |
| Status pill in the header | `MobileMapFooter` under the E-stop (phone), `TabletShell` header (tablet) |
| E-stop in the map footer | `MobileMapFooter`, `EmergencyButton compact` |
| Reconnecting pill over the map | `MobileMapFooter`, in place of the map name |
| Zoom, fit and rotate buttons | "⋮" column in the map's top-left, behind a "−" button that folds every map control away |
| Mode-side buttons (route, coverage, Auto Align, Set Position as Home Base) | 44 px circles with a caption (`MOBILE_SIDE_BTN`, `MOBILE_SIDE_CAPTION` in `navConstants.ts`) |
| Hover tooltips on route buttons | `MobileModeGuide` card `multi-pin`, once per session (`hasSeenMultiPinGuide`) |
| Coverage, Map Sync and Auto Align result pictures (landscape SVG) | `MobileModeGuide` cards `coverage`, `map-sync`, `align-result` with real text |
| Page instruction images | `mobile_instruction_{control,mapping,database}.svg` in `ControlInstruction` |
| Info label above the action bar | Dismissible strip above the map footer; a dismissal holds for that text only |
| Database extra columns and **Go to the Map** | Row tap opens a sheet: preview, last editor, size, Rename, Delete, Go to the Map |
| Database column-header sorting | **Sort maps** in the bottom bar: column and direction in one tap |

The Mode List starts folded on touch devices (`useMapState(!isMobile)`) so it does not cover the map
until asked for. `src/utils/statusColor.ts` holds the status pill colour so the desktop header and
the touch pills cannot disagree.

### Portals and stacking {#portals}

Some content renders outside its React parent on purpose:

- `PreviewMap` portals into the camera panel's preview slot.
- `ManualAutopilotPanel` portals its dialogs (sync overlay, autopilot confirm) to `document.body` on
  touch devices: on a phone its switches are also pressed from the drive bar while the menu sheet,
  an `invisible` ancestor, is closed.
- On a phone, the drive bar and joystick portal into the shell's two slots, found by id after mount.

Modals use phone-sized widths and sit above the map controls (menu sheet `z-[70]`, mode guides and
instructions `z-[80]`, database sheets and the login documents menu `z-[90]`).

### Session storage keys {#storage}

| Key | Meaning |
| --- | --- |
| `mobileCameraPanel` | `hidden` after the operator hid the camera panel |
| `mobileMenuHintSeen` | First-visit pointer at the Menu button was dismissed |
| `hasSeenMultiPinGuide` | The Multiple Pinpoints card was shown this session |

## Manual driving on touch {#joystick}

Touch devices have no keyboard, so `ManualAutopilotPanel` adds `TouchJoystick`. It writes its
deflection (`x` right, `y` forward, each in -1..1, or `null` while untouched) to `stickRef`, which
the same 10 Hz publish loop as the W A S D keys reads first:

```ts
publishTwist(stick.y * SPEED_NORMAL.linear, -stick.x * SPEED_NORMAL.angular); // right = -z
```

Speed is analog and capped at the keyboard's normal speeds (0.4 m/s, 1.0 rad/s); pushing the knob
part way replaces Shift for slow. A dead zone of 0.12 in the middle sends zero.

The robot stops the same way it does on a key-up. `stickRef` is cleared, and the next tick sends a
zero twist, on `pointerup`, `pointercancel` and lost pointer capture, when the joystick unmounts
(Manual Override off, page left, pad tucked mid-drive), on window blur, and when manual mode ends.

| Device | Placement |
| --- | --- |
| Phone | `docked`: in `#mobile-drive-pad` beside the camera. `PhoneDriveBar` in `#mobile-drive-bar` above it repeats the Manual and Autopilot switches and the rosbridge dot, so the operator can stop without opening the menu. If the camera row is hidden, the row stays while the pad is in it. |
| Tablet | `floating`: fixed at the bottom-right (over the map in portrait), with a handle that tucks it into the right edge. Tucking releases the stick first. |

**Contracts:** the joystick publishes the same
[`geometry_msgs/Twist` on `server/key_vel`](/development/message-contracts/rosbridge#publications)
as the keyboard; the toggles are unchanged ([`POST /api/manual`](/development/message-contracts/http-api#manual),
[`POST /api/autopilot`](/development/message-contracts/http-api#autopilot)). See
[Manual Override & Autopilot](/development/webui/navigation/manual-and-autopilot).
