export type CvPackage = {
  id: string;
  name: string;
  priceTsh: number;
  description: string;
  inclusions: string[];
  recommended?: boolean;
};

export const cvPackages: CvPackage[] = [
  {
    id: "basic",
    name: "Basic CV",
    priceTsh: 7000,
    description: "A clean, well-organized CV that makes your background easy to read.",
    inclusions: ["Clear CV sections and readable formatting", "Grammar, spelling, and layout review", "PDF and editable Word files"],
  },
  {
    id: "professional-ats",
    name: "Professional ATS CV",
    priceTsh: 10000,
    description: "A role-focused CV with straightforward headings and relevant keywords based on your real experience.",
    inclusions: ["ATS-aware structure and clear section headings", "Relevant skills and vacancy keywords from your information", "Professional summary refinement", "PDF and editable Word files"],
    recommended: true,
  },
  {
    id: "executive-specialist",
    name: "Executive / Specialist CV",
    priceTsh: 15000,
    description: "A polished profile for leadership, senior, or highly specialized roles.",
    inclusions: ["Executive or specialist profile and expertise sections", "Career history organized around your supplied experience", "Genuine achievements clearly presented", "PDF and editable Word files"],
  },
  {
    id: "cv-application-letter",
    name: "CV + Application Letter",
    priceTsh: 12000,
    description: "A coordinated CV and application letter tailored to one target opportunity.",
    inclusions: ["One role-focused CV and matching letter", "Grammar, spelling, and formatting review", "PDF and editable Word files"],
  },
  {
    id: "application-letter",
    name: "Application Letter Only",
    priceTsh: 2000,
    description: "A clear, tailored application letter built from the vacancy details and your background.",
    inclusions: ["One targeted application letter", "Grammar and formatting review", "PDF and editable Word files"],
  },
];

export type CvCategory = {
  id: string;
  name: string;
  description: string;
  suitableFor: string;
  packageIds: string[];
};

export const cvCategories: CvCategory[] = [
  {
    id: "first-time",
    name: "First-Time Job Seeker CV",
    description: "Build a confident first CV around your education, practical attachments, projects, volunteering, and transferable skills. We keep it honest and do not present study or volunteer work as paid employment.",
    suitableFor: "Recent graduates, school leavers, interns, and applicants with limited formal work experience.",
    packageIds: ["basic", "professional-ats", "cv-application-letter", "application-letter"],
  },
  {
    id: "experienced",
    name: "Experienced Professional CV",
    description: "Organize your career history, relevant skills, and accomplishments into a clear profile for your next role. Achievement statements are based only on details you provide.",
    suitableFor: "Professionals with work experience who want to update, improve, or target their CV for a new opportunity.",
    packageIds: ["basic", "professional-ats", "cv-application-letter", "application-letter"],
  },
  {
    id: "academic",
    name: "Academic CV",
    description: "Present your academic background and relevant scholarly or teaching experience in a structured format, using only the qualifications, research, publications, and activities you share.",
    suitableFor: "Lecturers, researchers, postgraduate applicants, and education professionals.",
    packageIds: ["basic", "executive-specialist", "cv-application-letter", "application-letter"],
  },
  {
    id: "hospitality-general",
    name: "Hospitality & General Jobs CV",
    description: "Bring customer service, operations, administration, and practical experience into a readable CV suited to general and service-sector vacancies.",
    suitableFor: "Applicants for hospitality, customer service, administration, retail, and general support roles.",
    packageIds: ["basic", "professional-ats", "cv-application-letter", "application-letter"],
  },
  {
    id: "technical-specialist",
    name: "Technical & Specialist CV",
    description: "Make technical strengths, certifications, tools, projects, and specialist experience easier for employers to scan, without overstating your expertise.",
    suitableFor: "Technical, healthcare, finance, engineering, IT, and other specialist applicants.",
    packageIds: ["professional-ats", "executive-specialist", "cv-application-letter", "application-letter"],
  },
  {
    id: "executive-management",
    name: "Executive & Management CV",
    description: "Present leadership scope, management experience, strategic work, and documented outcomes in a concise senior-level profile.",
    suitableFor: "Experienced managers, department heads, executives, and senior specialists.",
    packageIds: ["professional-ats", "executive-specialist", "cv-application-letter", "application-letter"],
  },
];

export const cvBenefits = [
  { title: "ATS-aware structure", description: "Clear headings and readable formatting designed to make your CV easier to scan." },
  { title: "Relevant keywords", description: "Role-related skills and keywords are selected from the vacancy and your actual background." },
  { title: "A stronger summary", description: "A focused professional summary that clearly introduces your real experience and goals." },
  { title: "Your achievements, clearly told", description: "Genuine results and work experience are organized and presented without inventing details." },
  { title: "Careful editing", description: "Grammar, spelling, consistency, and document formatting receive a thoughtful review." },
  { title: "Useful file formats", description: "PDF and editable Word files are supplied according to the selected package." },
  { title: "Personalized support", description: "Guidance is tailored for first-time applicants as well as experienced professionals." },
];

export const cvWhatsAppNumber = "0743 738 062";
export const cvWhatsAppBaseUrl = "https://wa.me/255743738062";

export function cvWhatsAppLink(message: string): string {
  return `${cvWhatsAppBaseUrl}?text=${encodeURIComponent(message)}`;
}

export function formatTsh(amount: number): string {
  return `TSh ${new Intl.NumberFormat("en-TZ", { maximumFractionDigits: 0 }).format(amount)}`;
}
