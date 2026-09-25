---
outline: deep
search: false
---

# Accounts & Access

<RoleBadge role="developer" />

The screens that stand between a person and the robot: the operator login and its unit picker, the
operator signup form, the separate admin console login, and the admin password-change screen. This
page introduces each screen and how they relate to one another. The cryptographic mechanics behind
the tokens they issue are in [Security & Tokens](/development/webui/accounts/security-and-tokens);
how a physical robot acquires its own credentials is in
[Hardware Enrolment](/development/webui/accounts/enrolment); how those tokens and the operating
lease actually reach the robot is in [ROS Integration](/development/webui/accounts/ros-integration).

## Operator login (`/`)

The root page is the operator's entry point: a login form posting to `POST /user/login`, and a unit
picker for choosing which robot to drive once signed in. It also carries the entry point into
signup, described below, but that link is hidden entirely on a unit or local build: a unit has no
accounts of its own, so there is nothing to sign up for there. Apart from that one link, this page
is purely about logging in as an operator.

## Operator signup (`/signup`)

A self-registration form for new operator accounts: username and email uniqueness checks, a
password and confirmation field, and a `ConfirmRegister` success dialog once the account is
created. Like the signup link on the login page, this screen is not present at all in local or unit
builds.

::: warning Signing up does not grant access to any robot
Creating an account here only creates a bare operator identity. It does not, by itself, grant
access to drive any unit: an administrator still has to separately assign the new operator to a
rental profile before they can see or operate a robot. Signup is identity creation, not
authorization.
:::

## Admin login (`/admin`)

A second, unlisted login screen, reached only by navigating to `/admin` directly, that calls a
distinct `adminLogin()` rather than the operator `/user/login` used on the root page. This is the
back-office door for fleet and tenant management staff, separate from anything an operator sees.

## Admin change password (`/admin/change-password`)

This screen has two distinct modes:

- **Forced**: a seeded or freshly reset admin account is redirected here before it can reach the
  admin dashboard at all, with no way back until the password is changed.
- **Voluntary**: reachable at any time from the account menu, with a `Back` option to leave without
  changing anything.

## Operator accounts and admin accounts are separate systems

The operator login above and the admin login are not two views onto one identity space: they are
entirely separate credential systems. The platform's security model, detailed in
[Security & Tokens](/development/webui/accounts/security-and-tokens), organizes authentication into
independent trust domains rather than a single shared login; the **Operator Domain** issued by the
cloud backend is what the operator login page authenticates against, and it is explicitly scoped to
human operators accessing the web dashboard. The admin login draws from its own, separate account
store and login path (`adminLogin()`, rather than the operator `/user/login`): the two screens do
not share a login form, a session, or a redirect path into one another.

## Related

- [Security & Tokens](/development/webui/accounts/security-and-tokens): JWT keyring, trust domains,
  and TLS termination.
- [Hardware Enrolment](/development/webui/accounts/enrolment): the nonce protocol a robot uses to
  register itself.
- [ROS Integration](/development/webui/accounts/ros-integration): how tokens and the operating
  lease reach the robot.
- [Architecture](/development/architecture): full platform topology and trust domains.
- [State & Behavior](/development/state-and-behavior): the robot-side state machine, including
  lease enforcement.
