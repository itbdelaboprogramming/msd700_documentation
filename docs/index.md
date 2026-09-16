---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "MSD700 Platform Documentation"
  text: "by ITB de Labo Research Lab"
  tagline: "Complete technical manual for operators, field technicians, and robotics developers."
  actions:
    - theme: brand
      text: User Guide
      link: /user-guide/
    - theme: alt
      text: Setup Guide
      link: /setup/
    - theme: alt
      text: Developer Docs
      link: /development/

features:
  - title: User Guide
    details: "For fleet operators: learn how to control robots, record SLAM maps, execute area sweeps, and monitor live video."
    link: /user-guide/
    linkText: Read the operator guide
  - title: Setup & Deployment
    details: "For field technicians: step-by-step installation guides for the cloud server stack and NVIDIA Jetson robot hardware."
    link: /setup/
    linkText: Read the technician setup guide
  - title: Developer Documentation
    details: "For software engineers: deep system architecture, 15-state EKF kinematics, message contracts, and REST API reference."
    link: /development/
    linkText: Read the developer documentation
---
