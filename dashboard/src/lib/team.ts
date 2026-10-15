// The team and its advisors, for the public page. `linkedin` is optional. Bios stay in the same shape
// (a role, then two or three plain sentences) so no one reads as an afterthought.

export const TEAM = [
  {
    name: "Marley Barrett",
    linkedin: "https://www.linkedin.com/in/marley-h-barrett/",
    role: "Project lead",
    bio: "A computer engineering major who works across software and project management. Interned on new product introduction and software engineering at Tesla, and on project management at Fincantieri in Trieste, Italy. Has sailed competitively through college and started a boat detailing business in high school.",
  },
  {
    name: "Patrick Grunklee",
    linkedin: "https://www.linkedin.com/in/patrickgrunklee/",
    role: "Hull and optimization lead",
    bio: "An industrial engineering major with experience in optimization, composites and DFM. Was a manufacturing engineer intern at Northrop Grumman, working in solid rocket motor composites manufacturing. Also has supply chain experience at John Deere, working on DFM and cost-optimal material selection for agricultural equipment.",
  },
  {
    name: "Will Hennen",
    role: "Electrical and power systems lead",
    bio: "An electrical engineering student who has spent the past two years interning with Xcel Energy, supporting a variety of solar, wind and battery energy storage system projects. Gained hands-on experience with high voltage, data acquisition systems, and the safety procedures and protocols required to work around high-voltage equipment.",
  },
  {
    name: "Ryan Drahozal",
    linkedin: "https://www.linkedin.com/in/ryan-drahozal/",
    role: "Embedded and firmware lead",
    bio: "A computer engineering student with experience in embedded, electrical and electromechanical systems. Built a robotic lifting assistive device for patients with sarcopenia (PCB design, motor drivers, current sensing, safety features). Has also completed two electrical engineering internships at Milwaukee Tool and conducts research at the UW–Madison Simulation-Based Engineering Lab.",
  },
  {
    name: "Peyton Olson",
    linkedin: "https://www.linkedin.com/in/peytonolson/",
    role: "Structural and mechanical lead",
    bio: "A mechanical engineering student and a member of the Baja SAE front suspension team. There, Peyton designed and analyzed the upper and lower control arms in SolidWorks, and machines and welds competition parts (lathe, CNC mill, MIG/TIG).",
  },
] as const;

export const ADVISORS = [
  {
    name: "Vincent Rasse",
    role: "Advisor: controls, battery and powertrain",
    bio: "Holds an MSc in Mechanical Engineering from ETH Zurich and is a researcher at MIT. A 2025 FSAE world champion, with three years in Formula Student, two of them full time: designed the battery and powertrain, built autonomous stack software, and served as Electrical Safety Officer (certified for high-voltage systems) and Autonomous Systems Responsible. Also a battery design engineer at Tesla, first as an intern and now full time.",
  },
  {
    name: "Kevin Macauley",
    role: "Advisor: controls, hull and simulation",
    bio: "A second-year PhD student in Mechanical Engineering at UW–Madison, where he also earned his BS in 2023. Researches swarm robotics in the UW–Madison Marine Robotics Lab, which designs and controls autonomous robots for complex aquatic environments.",
  },
] as const;

// The primary groups, named for their leads. Also the areas a prospective member can say they want to join.
export const GROUPS = ["Hull and optimization", "Structural and mechanical", "Electrical and power systems", "Embedded, firmware and low voltage", "Software"] as const;
