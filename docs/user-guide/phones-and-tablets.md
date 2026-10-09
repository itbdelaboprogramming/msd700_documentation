---
search: false
---

# Phones & Tablets

<RoleBadge role="user" />

The operator dashboard also runs on phones and tablets, with a touch layout of its own. It has the same pages (Navigation, Mapping, Database) and talks to the robot in exactly the same way as on a desktop; only the arrangement on the page differs. The [Admin Console](/user-guide/admin-console) is the exception: it still needs a desktop or laptop.

## Which Layout You Get {#layouts}

The dashboard picks the layout from the device, not from the window size:

| Device | Layout | Orientation |
| --- | --- | --- |
| Desktop or laptop, including touchscreen laptops | Desktop layout | Window at least 1400 x 720 |
| Phone (screen shorter than 600 px on its narrow side) | Phone layout | Portrait only |
| Tablet | Tablet layout | Portrait or landscape |

On a phone held sideways, a **Turn your phone upright** notice covers the page. The page stays loaded underneath it: anything the robot is doing keeps running, and turning the phone back removes the notice. Rotating a tablet rearranges the page without reloading the map or the camera.

## Logging In {#logging-in}

On a phone the login page shows one card at a time: first the sign-in form, then the list of units. **Change account** on the unit list brings the sign-in form back. The round **Documents** button in the bottom left opens the same operator documents the desktop footer links to.

## The Phone Layout {#phone-layout}

From top to bottom:

1. **Header**: your name and unit, and the close button.
2. **Page row**: the current page (tap it to open the menu) and the LiDAR and connection indicators.
3. **Map**, or the map list on the Database page.
4. **Camera panel** (Navigation and Mapping).
5. **Bottom bar**: **Menu**, **Camera** (show or hide the camera panel), **Instructions**, and on Database **Sort maps**.

The **Menu** button opens a sheet with the three pages and, on Navigation and Mapping, the **Robot Control** panel (Manual Override and Autopilot). On your first visit a hint points at the Menu button, since it is the only way to the other pages on a phone.

## The Tablet Layout {#tablet-layout}

A tablet has room for more, so nothing hides in a menu:

- The three pages are tabs under the header, and the robot status sits in the header.
- The camera and **Robot Control** sit beside the map: in a column on the left in landscape, in a row under the map in portrait.

## Controls on the Map {#controls-on-the-map}

The map takes the same gestures as on a touchscreen laptop (pinch to zoom, two fingers to pan, touch and drag to place a pin, double-tap to remove one; see [Moving Around the Map](/user-guide/navigation#moving-around-the-map)). The buttons over it are smaller than on a desktop:

- **Minus / Plus** (top left) hides all map buttons so you can see the whole map, and shows them again.
- **Dots** under it opens **Zoom in**, **Zoom out**, **Fit the map** and **Rotate the map**.
- **Play**, **Pause** and **Return Home** (Navigation), or **Play**, **Pause** and **Stop** (Mapping), are round buttons along the top. **Focus View** is on the top right.
- The **Mode List** starts folded; tap it to open it. The buttons a mode adds (Save Route, Load Route, Round Trip, Auto Align, the coverage options and so on) appear as round buttons with a short caption beside the Mode List.
- The **emergency stop** is in the bottom left corner of the map, always visible. On a phone the robot status is right under it; on a tablet it is in the header.
- Hints such as "place a pinpoint" appear as a strip above the map footer. Tap **x** to dismiss one.

Hover tooltips do not exist on a touch screen, so the explanations come as cards instead. The first time you choose **Multiple Pinpoints** in a session, a card explains Save Route, Load Route, Round Trip and Loop Route. Coverage, Map Sync and the Auto Align result use cards too. Tap outside a card to close it.

## Camera and Map Overview {#camera-panel}

On Navigation, the small switch in the bottom left of the camera panel flips between the **Camera** and the map overview (**Preview**), which the desktop shows in the corner of the map. Both keep running when hidden, so switching back is instant. The **Camera** button in the bottom bar hides the whole panel to give the map more room.

## Driving with the Joystick {#driving-with-the-joystick}

Touch devices have no keyboard, so **Manual Override** drives from an on-screen joystick instead of the W A S D keys:

1. Open **Robot Control** (the Menu on a phone; beside the map on a tablet) and turn **Manual Override** ON.
2. On a phone, close the menu. The joystick sits next to the camera, with small **Manual** and **Autopilot** switches above it, so you can stop driving without opening the menu again.
   On a tablet the joystick floats at the right edge. Its handle slides it out of the way and back.
3. Drag the knob. The further you push, the faster the robot goes, up to the normal speed (`0.40 m/s` forward, the same as the W key). Left and right turn the robot.
4. Lift your finger and the robot stops at once.

The robot also stops when you turn Manual Override off, leave the page, hide the joystick mid-drive, or switch to another app. There is no slow mode button: push the knob only part way for slow, precise movement.

## Maps on the Database Page {#database}

The phone list shows only the number, the map name and the date modified. Tap a row to open a sheet with a preview of the map, who changed it last and its size, plus **Rename**, **Delete** and **Go to the Map**. **Sort maps** in the bottom bar sorts by name (A to Z, Z to A) or date (newest or oldest first).

## Troubleshooting {#troubleshooting}

- **"Turn your phone upright"**: hold the phone in portrait. Nothing is lost while the notice is up.
- **"Desktop only" on a phone or tablet**: you opened the Admin Console. Use a desktop or laptop for it; the operator pages work on this device.
- For anything else, see [Troubleshooting](/user-guide/troubleshooting).
