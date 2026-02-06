export interface BusinessProfile {
  name: string;
  profession: string;
  company: string;
  email: string;
  phone: string;
  linkedin: string;
  bio: string;
  initialsColor: string;
}

export const PRESET_PROFILES: BusinessProfile[] = [
  {
    name: "Sarah Chen",
    profession: "VP of Engineering",
    company: "NovaTech Systems",
    email: "sarah.chen@novatech.io",
    phone: "+1 (415) 555-0142",
    linkedin: "linkedin.com/in/sarahchen",
    bio: "Building distributed systems that scale. 15 years in cloud infrastructure. Speaker at re:Invent and KubeCon.",
    initialsColor: "#6366f1",
  },
  {
    name: "Marcus Rivera",
    profession: "Product Designer",
    company: "DesignCraft Studio",
    email: "marcus@designcraft.co",
    phone: "+1 (212) 555-0198",
    linkedin: "linkedin.com/in/marcusrivera",
    bio: "Crafting delightful user experiences for enterprise SaaS. Previously at Figma and Stripe.",
    initialsColor: "#ec4899",
  },
  {
    name: "Aisha Patel",
    profession: "Data Science Lead",
    company: "Meridian Analytics",
    email: "aisha.patel@meridian.ai",
    phone: "+1 (650) 555-0267",
    linkedin: "linkedin.com/in/aishapatel",
    bio: "Turning messy data into actionable insights. PhD in ML from Stanford. Passionate about ethical AI.",
    initialsColor: "#14b8a6",
  },
  {
    name: "James Okafor",
    profession: "CTO & Co-founder",
    company: "BrightPath Health",
    email: "james@brightpath.health",
    phone: "+1 (312) 555-0334",
    linkedin: "linkedin.com/in/jamesokafor",
    bio: "Healthcare tech entrepreneur. Building the future of telemedicine. Forbes 30 Under 30 alum.",
    initialsColor: "#f97316",
  },
  {
    name: "Elena Volkov",
    profession: "Security Architect",
    company: "CipherGuard",
    email: "elena.v@cipherguard.com",
    phone: "+1 (703) 555-0412",
    linkedin: "linkedin.com/in/elenavolkov",
    bio: "Zero-trust advocate. 12 years in cybersecurity. CISSP. Previously led security at a Fortune 100.",
    initialsColor: "#8b5cf6",
  },
  {
    name: "David Kim",
    profession: "DevRel Engineer",
    company: "OpenStack Labs",
    email: "dkim@openstacklabs.dev",
    phone: "+1 (206) 555-0587",
    linkedin: "linkedin.com/in/davidkim-dev",
    bio: "Developer advocate and open-source maintainer. Runs the WebAssembly meetup. Loves Rust.",
    initialsColor: "#22c55e",
  },
  {
    name: "Priya Sharma",
    profession: "Engineering Manager",
    company: "Quantum Payments",
    email: "priya.sharma@quantumpay.io",
    phone: "+1 (408) 555-0643",
    linkedin: "linkedin.com/in/priyasharma-eng",
    bio: "Leading a team of 30 engineers building real-time payment rails. Ex-Stripe, ex-Square.",
    initialsColor: "#e11d48",
  },
  {
    name: "Tom Andersen",
    profession: "Solutions Architect",
    company: "CloudBridge Consulting",
    email: "tom@cloudbridge.io",
    phone: "+1 (720) 555-0721",
    linkedin: "linkedin.com/in/tomandersen",
    bio: "Helping enterprises modernize. AWS and Azure certified. Author of 'Cloud Migration Playbook'.",
    initialsColor: "#0ea5e9",
  },
];

export function getProfileByIndex(index: number): BusinessProfile {
  return PRESET_PROFILES[index % PRESET_PROFILES.length];
}
