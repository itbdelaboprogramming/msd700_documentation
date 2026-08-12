---
search: false
---

# Changelog

<RoleBadge role="developer" />

This project's history is tracked in Git rather than duplicated here. Each repository has its own commit history:

- [msd700_documentation](https://github.com/itbdelaboprogramming/msd700_documentation/commits/main): this docs site
- [ros-web-ui](https://github.com/itbdelaboprogramming/ros-web-ui/commits/main): backend, frontend build context, web-facing ROS packages
- [msd700_robot](https://github.com/itbdelaboprogramming/msd700_robot/commits/main): navigation, SLAM, hardware drivers
- [msd700_noetic](https://github.com/itbdelaboprogramming/msd700_noetic/commits/main): robot-side Docker orchestration

There's no unified cross-repo release process today: a "version" of MSD700 is really "whatever
commit each repo's `main` is on," which is why [Repository Structure](/development/repository-structure)
and [Architecture](/development/architecture) describe current behavior rather than a fixed release.
