export const CV_ATS_CATEGORY_WEIGHTS = {
  atsCompatibility: 25,
  contactDetails: 10,
  workExperience: 15,
  jobRelevance: 15,
  education: 10,
  grammar: 10,
  formatting: 10,
  completeness: 5,
} as const;

export type CvAtsCategoryId = keyof typeof CV_ATS_CATEGORY_WEIGHTS;
export type CvAtsFinding = { issue: string; suggestion: string };
export type CvAtsCategory = {
  id: CvAtsCategoryId;
  label: string;
  weight: number;
  score: number;
  points: number;
  summary: string;
  findings: CvAtsFinding[];
};
export type CvAtsReport = {
  score: number;
  categories: CvAtsCategory[];
  strengths: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  targetProvided: boolean;
  disclaimer: string;
};

type Check = { pass: boolean; points: number; issue: string; suggestion: string };
type CategoryDraft = Omit<CvAtsCategory, "score" | "points" | "findings"> & { checks: Check[] };

const LABELS: Record<CvAtsCategoryId, string> = {
  atsCompatibility: "ATS compatibility",
  contactDetails: "Contact details",
  workExperience: "Work experience",
  jobRelevance: "Job relevance & keywords",
  education: "Education",
  grammar: "Grammar indicators",
  formatting: "Formatting & readability",
  completeness: "Completeness",
};
const DISCLAIMER = "This is a text-based heuristic review, not an actual ATS test, professional proofread, hiring decision or guarantee of ATS success, interviews or employment. Parsing cannot fully inspect visual layout, columns, fonts or every formatting detail. Review the CV yourself and follow the employer’s instructions.";
const headingPattern = /^(?:professional\s+)?(?:summary|profile|objective|career\s+summary|work\s+experience|professional\s+experience|employment\s+history|experience|education|qualifications|skills|technical\s+skills|certifications|projects|achievements|references)\s*:?\s*$/im;
const commonTerms = new Set("the and for with from this that your you are our all not will has have job role work team skills experience knowledge ability required preferred about into within across including using use years education degree successful candidate position responsibilities qualifications requirements description location apply application strong excellent preferred plus their they them these those who what where when how its also such each per via etc through across into onto based including".split(" "));
const wordTokens = (input: string) => (input.toLowerCase().match(/[a-z][a-z0-9+#.-]{2,}/g) ?? []).map(word => word.replace(/[.+-]+$/g, "")).filter(word => word.length >= 3 && !commonTerms.has(word));
const any = (text: string, pattern: RegExp) => pattern.test(text);

function category(draft: CategoryDraft): CvAtsCategory {
  const weightSum = draft.checks.reduce((total, item) => total + item.points, 0) || 1;
  const earned = draft.checks.reduce((total, item) => total + (item.pass ? item.points : 0), 0);
  const score = Math.max(0, Math.min(100, Math.round(earned / weightSum * 100)));
  const findings = draft.checks.filter(item => !item.pass).map(({ issue, suggestion }) => ({ issue, suggestion }));
  return { id: draft.id, label: draft.label, weight: draft.weight, score, points: Math.round(score * draft.weight) / 100, summary: draft.summary, findings };
}

export function scoreCvAts(cvText: string, targetJobText = ""): CvAtsReport {
  const text = cvText.replace(/\u0000/g, " ").replace(/\r\n?/g, "\n").trim();
  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  const lower = text.toLowerCase();
  const targetProvided = targetJobText.trim().length > 0;
  const jobTerms = [...new Set(wordTokens(targetJobText))].slice(0, 40);
  const cvTerms = new Set(wordTokens(text));
  const matchedKeywords = jobTerms.filter(term => cvTerms.has(term)).slice(0, 20);
  const missingKeywords = jobTerms.filter(term => !cvTerms.has(term)).slice(0, 15);
  const emailFound = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text);
  const phoneFound = /(?:\+?\d[\d\s()./-]{6,}\d)/.test(text);
  const nameLike = lines.find(line => line.length >= 2 && line.length <= 70 && !/@|\d{3}|https?:|linkedin\.com/i.test(line) && !headingPattern.test(line));
  const experienceHeading = any(text, /\b(work|professional|employment)\s+(experience|history)\b|\bexperience\b/i);
  const educationHeading = any(text, /\b(education|academic background|qualifications)\b/i);
  const skillsHeading = any(text, /\b(skills|technical skills|core competencies|competencies)\b/i);
  const summaryHeading = any(text, /\b(summary|professional profile|career objective|profile)\b/i);
  const dateEvidence = any(text, /\b(?:19|20)\d{2}\b(?:\s*[-–—]\s*(?:present|current|now|(?:19|20)\d{2}))?/i);
  const metricEvidence = any(text, /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:%|percent|people|staff|clients|customers|projects|days|months|years|tzs|usd|million|k\b)/i);
  const bullets = lines.filter(line => /^(?:[•●▪◦*–—-]|\d+[.)])\s+/.test(line)).length;
  const longLines = lines.filter(line => line.length > 240).length;
  const headingsCount = lines.filter(line => line.length <= 55 && headingPattern.test(line)).length;
  const linkedProfile = any(text, /\blinkedin\.com\/in\//i);
  const hasPortfolio = any(text, /\b(?:portfolio|github\.com|behance\.net)\b/i);
  const degreeEvidence = any(text, /\b(?:bachelor'?s?|master'?s?|ph\.?d\.?|doctorate|diploma|certificate|bsc|b\.?a\.?|msc|mba|llb|hnd|gce|n[cv]e?)\b/i);
  const institutionEvidence = any(text, /\b(university|college|institute|school|polytechnic|academy)\b/i);
  const jobMatched = targetProvided && jobTerms.length ? matchedKeywords.length / jobTerms.length : 0;
  const jobKeywordsPresent = any(text, /\b(skills|competencies|tools|technologies|proficient|experienced|specialist|professional)\b/i);
  const targetFindings: Check[] = targetProvided
    ? [
        { pass: jobTerms.length >= 5, points: 1, issue: "The supplied role description produced few distinct keywords for comparison.", suggestion: "Include the full responsibilities and qualifications so the comparison has useful role-specific terms." },
        { pass: jobMatched >= 0.65, points: 2, issue: `Only ${Math.round(jobMatched * 100)}% of the sampled role keywords appear in the CV text.`, suggestion: "Review the missing terms and add only those skills or experiences you can honestly support." },
        { pass: matchedKeywords.length >= 5, points: 1, issue: "Few relevant role keywords were found in common.", suggestion: "Use precise terms from the job description where they accurately describe your experience." },
      ]
    : [
        { pass: jobKeywordsPresent, points: 2, issue: "No target job description was supplied, so role-specific keyword overlap cannot be measured.", suggestion: "For a role-specific score, paste the target job description and retest." },
        { pass: cvTerms.size >= 30, points: 2, issue: "The CV contains a limited range of searchable professional terms.", suggestion: "Add accurate tools, methods, role terms and domain skills relevant to your work." },
      ];

  const drafts: CategoryDraft[] = [
    {
      id: "atsCompatibility", label: LABELS.atsCompatibility, weight: 25, summary: "Checks whether the extracted text contains common, clearly labeled CV sections and enough readable content.",
      checks: [
        { pass: text.length >= 1200, points: 2, issue: "The readable CV text is quite short.", suggestion: "Add relevant details to each role, qualification and skills section without padding." },
        { pass: headingsCount >= 3, points: 3, issue: "Few standard section headings were detected.", suggestion: "Use simple headings such as Summary, Work Experience, Education and Skills." },
        { pass: lines.length >= 12, points: 2, issue: "The document extracts as only a few text lines.", suggestion: "Use selectable text and a straightforward reading order; avoid image-only or heavily columned layouts." },
        { pass: !/\uFFFD|\u0000/.test(text), points: 1, issue: "Some characters may not have extracted cleanly.", suggestion: "Check the exported PDF/DOCX and retype any symbols or text that appear corrupted." },
      ],
    },
    {
      id: "contactDetails", label: LABELS.contactDetails, weight: 10, summary: "Looks for basic contact methods and a plausible name line in the extracted text.",
      checks: [
        { pass: Boolean(nameLike), points: 2, issue: "A clear name line was not detected near the beginning of the CV.", suggestion: "Place your full name prominently at the top of the document." },
        { pass: emailFound, points: 3, issue: "No email address was detected.", suggestion: "Add a current, professional email address and verify that it is spelled correctly." },
        { pass: phoneFound, points: 3, issue: "No phone number was detected.", suggestion: "Add a current phone number, including country code when applying internationally." },
        { pass: linkedProfile || hasPortfolio, points: 1, issue: "No professional profile or portfolio link was detected.", suggestion: "If relevant, add a working LinkedIn, portfolio or code-work link." },
        { pass: lines.slice(0, 12).some(line => /\b(?:dar es salaam|dodoma|arusha|mwanza|zanzibar|tanzania|tz|location|address)\b/i.test(line)), points: 1, issue: "No location or location label was detected near the contact details.", suggestion: "Add your city/region if it is relevant to the role; avoid sharing a full home address unless required." },
      ],
    },
    {
      id: "workExperience", label: LABELS.workExperience, weight: 15, summary: "Looks for work-history structure, role dates and evidence of responsibilities or results.",
      checks: [
        { pass: experienceHeading, points: 2, issue: "A work-experience section heading was not detected.", suggestion: "Add a Work Experience or Employment History section when you have relevant experience." },
        { pass: dateEvidence, points: 2, issue: "Few recognizable employment or qualification dates were detected.", suggestion: "Add clear month/year or year ranges for roles, such as 2022–2024 or 2024–Present." },
        { pass: any(text, /\b(manager|officer|assistant|engineer|teacher|analyst|coordinator|supervisor|intern|consultant|developer|nurse|accountant|technician|volunteer|founder|director|specialist)\b/i), points: 2, issue: "A role title or responsibility level was not clearly detected.", suggestion: "Label each position with your title, organization and dates." },
        { pass: any(text, /\b(led|managed|built|created|delivered|improved|supported|coordinated|designed|analyzed|analysed|served|trained|developed|implemented|maintained|organized|organised|achieved)\b/i), points: 2, issue: "Few action-oriented accomplishment statements were detected.", suggestion: "Start bullets with accurate action verbs and describe what you personally did." },
        { pass: metricEvidence, points: 2, issue: "No measurable result or scope indicator was detected.", suggestion: "Where truthful, quantify outcomes with scale, time, volume, quality or cost measures." },
      ],
    },
    {
      id: "jobRelevance", label: LABELS.jobRelevance, weight: 15, summary: targetProvided ? `Compared extracted CV terms with ${jobTerms.length} distinct terms from the supplied target description.` : "Reviews searchable professional vocabulary; add a target description for a direct keyword comparison.",
      checks: targetFindings,
    },
    {
      id: "education", label: LABELS.education, weight: 10, summary: "Looks for an education/qualification section, named credential and institution.",
      checks: [
        { pass: educationHeading, points: 3, issue: "An Education or Qualifications heading was not detected.", suggestion: "Add an Education or Qualifications section; if you have no formal qualification, list relevant training instead." },
        { pass: degreeEvidence, points: 3, issue: "No degree, certificate or qualification term was detected.", suggestion: "List your actual qualification or relevant courses and certificates, with the correct level and name." },
        { pass: institutionEvidence, points: 2, issue: "No education provider was detected.", suggestion: "Include the institution or training provider when appropriate." },
        { pass: any(text, /\b(?:19|20)\d{2}\b/), points: 1, issue: "No education or career dates were detected.", suggestion: "Add completion dates when useful; omit dates if they could introduce irrelevant bias and are not requested." },
      ],
    },
    {
      id: "grammar", label: LABELS.grammar, weight: 10, summary: "Flags a few basic text patterns only; this is not a full grammar or spelling proofread.",
      checks: [
        { pass: !/\b([A-Za-z]{2,})\s+\1\b/i.test(text), points: 2, issue: "A repeated word appears next to itself.", suggestion: "Review for accidental repeated words." },
        { pass: !/\b(?:teh|recieve|seperate|responsibile|managment|experiance|sucessful|adress|occured)\b/i.test(text), points: 2, issue: "A possible common spelling error was detected.", suggestion: "Review flagged words with a spelling checker or trusted proofreader." },
        { pass: !/\s+[,.!?;:]/.test(text), points: 1, issue: "Punctuation spacing may be inconsistent.", suggestion: "Remove spaces before punctuation and check spacing after each sentence." },
        { pass: !lines.some(line => line.split(/\s+/).length > 45), points: 2, issue: "One or more lines are unusually long and may be hard to scan.", suggestion: "Break long descriptions into concise sentences or bullet points." },
        { pass: !/\b(?:i am|i have|i was)\b/i.test(text), points: 1, issue: "First-person phrasing appears in the CV.", suggestion: "Consider concise resume-style phrasing, usually without repeating 'I', if that fits the employer's expectations." },
      ],
    },
    {
      id: "formatting", label: LABELS.formatting, weight: 10, summary: "Uses extracted text cues for headings, line lengths and lists; it cannot inspect visual styling or column order reliably.",
      checks: [
        { pass: headingsCount >= 3, points: 2, issue: "The document does not show several recognizable section headings in extracted text.", suggestion: "Use consistent, plain-text section labels and a logical top-to-bottom order." },
        { pass: bullets >= 3, points: 2, issue: "Few list or bullet entries were detected.", suggestion: "Use concise bullets for duties, achievements and skills; check that the exported text preserves their order." },
        { pass: longLines <= Math.max(2, Math.ceil(lines.length * 0.15)), points: 2, issue: "Several extracted lines are unusually long.", suggestion: "Keep paragraphs concise and use clear line breaks between roles and sections." },
        { pass: !/\t{3,}| {5,}/.test(text), points: 1, issue: "Repeated spaces or tabs may be used to position content.", suggestion: "Avoid manual spacing to create columns; use a simple single-column layout." },
        { pass: !/[\uFFFD]/.test(text), points: 1, issue: "Some layout or glyph content may not be represented in extracted text.", suggestion: "Open the final file and visually check its reading order, headings and page breaks." },
      ],
    },
    {
      id: "completeness", label: LABELS.completeness, weight: 5, summary: "Checks for a balanced set of common CV sections and contact information.",
      checks: [
        { pass: emailFound && phoneFound, points: 1, issue: "Contact information appears incomplete.", suggestion: "Include at least an email address and a current phone number." },
        { pass: summaryHeading || lines.length > 0, points: 1, issue: "A short professional summary or profile was not detected.", suggestion: "Add a concise, role-relevant introduction if it helps explain your focus." },
        { pass: experienceHeading, points: 1, issue: "Work history is not clearly labeled.", suggestion: "Add relevant employment, projects, volunteering or practical experience." },
        { pass: educationHeading, points: 1, issue: "Education or training is not clearly labeled.", suggestion: "Include relevant formal education, certificates or vocational training." },
        { pass: skillsHeading, points: 1, issue: "A skills section was not detected.", suggestion: "List accurate, specific skills that are relevant to your target roles." },
      ],
    },
  ];

  const categories = drafts.map(category);
  const score = Math.max(0, Math.min(100, Math.round(categories.reduce((sum, item) => sum + item.points, 0))));
  const strengths = categories.filter(item => item.score >= 75).map(item => `${item.label}: ${item.score}/100`);
  return { score, categories, strengths, matchedKeywords, missingKeywords, targetProvided, disclaimer: DISCLAIMER };
}
