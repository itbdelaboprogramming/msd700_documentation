# FAQ

<RoleBadge role="user" />

Frequently asked questions from MSD700 users.

::: details What is MSD700?
See the [Introduction](/getting-started/introduction) page.
:::

::: details I logged in but don't see any units. Why?
Your account exists, but nobody has granted it access to a unit yet. Access is managed by an admin
through rental profiles: ask them to add your account to the right profile.
:::

::: details Can two people control the same robot at once?
No. A unit has exactly one active operator at a time. If a unit shows **In Use**, another account is
currently driving; you can still open the unit, you just do not get control. If it is another session
of your *own* account (a second tab, or the unit's own local dashboard), you get an explicit
**Take Over** prompt, and the session that loses control is told so. See
[How the Robot Behaves](/getting-started/behavior#only-one-person-drives-at-a-time).
:::

::: details What happens if I lose my internet connection while driving?
Three things, at increasing intervals. After about **10 seconds** the robot stops moving but keeps
your operation loaded, and it resumes as soon as you reconnect. After **10 minutes** the operation is
torn down and the robot goes idle. After **30 minutes** it powers its hardware down, which needs an
explicit restart. See [How the Robot Behaves](/getting-started/behavior#what-happens-when-you-disconnect).
:::

::: details Can I close the browser and let the robot finish on its own?
Yes, with **Autopilot** switched on. It suspends all three of the safety timers above and hands
waypoint stepping to the robot itself, so a route finishes with no browser attached and logging out
does not stop it. Turning it back off re-arms every safety pause immediately. Use it for long
unattended routes, not for spaces you have not run before.
:::

::: details I refreshed the page mid-operation. Did I lose the run?
No. The robot is the one keeping score, so a refresh, a new tab, or logging in from a different
machine all restore the whole operation: your waypoints, which one it is on, the map, and any
coverage areas. The one exception is opening a map from the Database page, which is a deliberate
reset.
:::

::: details The robot shows "Robot Stuck": is something wrong?
Not necessarily. It appears briefly during tight turns, and for up to a minute at the start of an
area coverage run while the sweep path is being computed. If it clears on its own, no action is
needed. If it stays up for several minutes, check the camera feed for an obstruction, then see
[Troubleshooting](/getting-started/troubleshooting).
:::

::: details Does Emergency Stop always work, even if someone else is driving?
Yes. E-Stop outranks every other source of movement on the robot and is available on every page
regardless of who holds control. It stays engaged until explicitly released.
:::

::: details Where do I find setup / installation instructions?
That's covered in the [Setup](/setup/) section, aimed at technicians installing the MSD700 Server
and Unit.
:::

::: details Who do I contact if something isn't working?
Start with [Troubleshooting](/getting-started/troubleshooting). If the issue looks like a hardware
or connectivity problem rather than something you can fix from the browser, escalate to the
technician responsible for your unit.
:::

## Didn't find your answer?

See [Troubleshooting](/getting-started/troubleshooting), or escalate to the technical [Setup &gt; Troubleshooting](/setup/troubleshooting) page.
