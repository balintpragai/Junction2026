/** Turns a chosen action into the work it actually implies.
 *
 *  "Send a My Kanta message" is not a step — it is the *last* step of a
 *  chain that starts with defining a cohort in the screening register and
 *  passes through a lawful-basis assessment, a translation, a clinical
 *  sign-off and a channel registration with Kela before a single message
 *  reaches anyone. This module writes that chain out, names the institution
 *  on the other end of each link, and says which of them the State can do
 *  and which only the Region can.
 *
 *  Deterministic: the same action in the same Region always expands the same
 *  way. The chain is derived from how Finland's screening pathway is
 *  actually governed (see docs/institutions.md for who each body is).
 */

import type { Lang } from "@/lib/i18n";
import { localizePhases, profileFi } from "@/lib/playbook-fi";
import type { CandidateAction } from "@/lib/api";
import type { StepFunction } from "@/lib/team";

export type Level = "state" | "regional";

export interface Counterparty {
  /** The institution that has to be notified, instructed or asked. */
  name: string;
  /** What this body is, in one line — most people don't know what Findata is. */
  role: string;
  kind: "national" | "regional" | "external";
}

export interface PlaybookStep {
  id: string;
  title: string;
  detail: string;
  func: StepFunction;
  counterparties: Counterparty[];
  durationDays: number;
  /** The artifact this step produces — what "done" looks like. */
  output: string;
  /** A hard blocker: nothing downstream may start until this clears. */
  gate?: string;
  level: Level;
}

export interface PlaybookPhase {
  id: string;
  name: string;
  summary: string;
  /** Steps inside a phase run in parallel; phases run in order. */
  steps: PlaybookStep[];
}

// --- the institutions, written once ----------------------------------------

const ORG = {
  stm: { name: "STM", role: "Ministry of Social Affairs and Health — owns the National Cancer Strategy", kind: "national" } as Counterparty,
  thl: { name: "THL", role: "Finnish Institute for Health and Welfare — steers and monitors the national screening programme", kind: "national" } as Counterparty,
  registry: { name: "Mass Screening Registry", role: "Finnish Cancer Registry — holds the screening invitation and attendance register", kind: "national" } as Counterparty,
  kela: { name: "Kela", role: "Social Insurance Institution — operates Kanta services and travel reimbursement", kind: "national" } as Counterparty,
  kanta: { name: "Kanta / My Kanta", role: "Kela's national patient data service and citizen portal", kind: "national" } as Counterparty,
  dvv: { name: "DVV", role: "Digital and Population Data Services Agency — Population Information System and Suomi.fi Messages", kind: "national" } as Counterparty,
  findata: { name: "Findata", role: "Health and Social Data Permit Authority — permits secondary use of health data", kind: "national" } as Counterparty,
  valvira: { name: "Valvira", role: "National Supervisory Authority for Welfare and Health — escalation if a statutory duty goes unmet", kind: "national" } as Counterparty,
  avi: { name: "AVI", role: "Regional State Administrative Agency — regional supervision of social and health services", kind: "national" } as Counterparty,
  posti: { name: "Posti", role: "Postal operator — paper fallback for people who do not use Kanta", kind: "external" } as Counterparty,
  hilma: { name: "Hilma", role: "National public procurement notice channel — required above the EU threshold", kind: "national" } as Counterparty,
  traficom: { name: "Traficom", role: "Transport and Communications Agency — broadband and mobile coverage data", kind: "national" } as Counterparty,
};

function county(regionName: string): Counterparty {
  return { name: regionName, role: "The wellbeing services county responsible for delivering the service", kind: "regional" };
}
function board(regionName: string): Counterparty {
  return { name: `${regionName} — county board`, role: "Decides the county's budget and service commitments", kind: "regional" };
}
function municipalities(regionName: string): Counterparty {
  return { name: `Municipalities in ${regionName}`, role: "Own the local sites, venues and road access the delivery depends on", kind: "regional" };
}
function ngos(regionName: string): Counterparty {
  return { name: `Community organisations in ${regionName}`, role: "Reach the groups a letter from the county does not", kind: "external" };
}

// --- the chains -------------------------------------------------------------

/** Every action starts the same way: the State has to put something on the
 *  record that the Region can act on. These two steps are already complete by
 *  the time a Region opens the directive — they are shown so the Region can
 *  see what it was given and on what evidence. */
function mandatePhase(regionName: string): PlaybookPhase {
  return {
    id: "mandate",
    name: "National mandate",
    summary: "What the State issued, and the evidence it rests on. Completed before the Region is notified.",
    steps: [
      {
        id: "mandate-evidence",
        title: "Attach the evidence pack",
        detail:
          "The Gap that triggered this action, the peer comparison behind it, the structural covariates that do and do not explain it, and the National Cancer Strategy clause it implements — assembled so the Region can contest the reasoning rather than just receive an instruction.",
        func: "data_analyst",
        counterparties: [ORG.thl, ORG.registry],
        durationDays: 1,
        output: "Evidence pack (Gap, peers, covariates, strategy citation)",
        level: "state",
      },
      {
        id: "mandate-issue",
        title: "Issue the directive to the Region",
        detail: `Formal notification to ${regionName} with a response deadline. The State's involvement pauses here: the Region owns every step that follows, and the State sees only the progress the Region reports.`,
        func: "screening_lead",
        counterparties: [ORG.stm, county(regionName)],
        durationDays: 1,
        output: "Issued directive with a statutory response window",
        level: "state",
      },
    ],
  };
}

function patientMessageChain(action: CandidateAction, regionName: string): PlaybookPhase[] {
  const profile = action.workflow.type === "patient_message" ? action.workflow.profile : "the invited population";
  const multilingual = action.id === "multilingual-outreach";
  const lowBandwidth = action.id === "low-bandwidth-channel";

  return [
    {
      id: "cohort",
      name: "Define who is contacted",
      summary: "A message to the wrong list is worse than no message. The cohort is built from the screening register, not from an estimate.",
      steps: [
        {
          id: "cohort-query",
          title: "Build the cohort from the screening register",
          detail: `Query the Mass Screening Registry for ${profile} — invited within the programme, in this Region, not yet attended in the current round. Produces a counted, reproducible list rather than an approximate target group.`,
          func: "data_analyst",
          counterparties: [ORG.registry, ORG.thl],
          durationDays: 3,
          output: "Cohort definition with a head count",
          level: "regional",
        },
        {
          id: "cohort-contact",
          title: "Resolve contact details and recorded language",
          detail:
            "Match the cohort against the Population Information System for current address, and for the native language recorded there — which is what decides the language each person's message is written in.",
          func: "data_analyst",
          counterparties: [ORG.dvv],
          durationDays: 2,
          output: "Contactable cohort with language breakdown",
          level: "regional",
        },
      ],
    },
    {
      id: "lawful",
      name: "Clear the legal basis",
      summary: "A health authority contacting named individuals about their cancer screening needs a documented basis before anything is drafted.",
      steps: [
        {
          id: "lawful-basis",
          title: "Record the lawful basis and run a DPIA",
          detail:
            "Confirm this is operational use within the county's own statutory screening duty, not secondary use. Document the basis, run the data-protection impact assessment, and set the retention period for the contact list.",
          func: "dpo",
          counterparties: [ORG.findata],
          durationDays: 5,
          output: "Signed DPIA and recorded lawful basis",
          gate: "No message may be drafted against real personal data until this clears.",
          level: "regional",
        },
      ],
    },
    {
      id: "content",
      name: "Write and approve the message",
      summary: "Content that is clinically correct, legally plain, and actually readable by the people it is aimed at.",
      steps: [
        {
          id: "content-draft",
          title: "Draft the invitation and the reminder",
          detail:
            "Two messages, not one: the invitation and the follow-up for non-responders. Written to plain-language standard, with the appointment action in the first sentence.",
          func: "communications",
          counterparties: [ORG.thl],
          durationDays: 4,
          output: "Approved copy for both waves",
          level: "regional",
        },
        ...(multilingual
          ? [
              {
                id: "content-translate",
                title: "Translate into the Region's actual top languages",
                detail:
                  "Not a generic translation pack — the languages the cohort's own DVV language field shows, produced with community organisations so the wording lands rather than merely parses.",
                func: "community_liaison" as StepFunction,
                counterparties: [ngos(regionName), ORG.dvv],
                durationDays: 7,
                output: "Reviewed translations per language",
                level: "regional" as Level,
              },
            ]
          : []),
        {
          id: "content-clinical",
          title: "Clinical sign-off",
          detail:
            "The Region's chief physician for screening signs that the message is clinically accurate and that the pathway it promises — the appointment, the site, the follow-up — exists and has capacity.",
          func: "chief_physician",
          counterparties: [],
          durationDays: 3,
          output: "Clinical approval on the record",
          gate: "Nothing is sent without this signature.",
          level: "regional",
        },
      ],
    },
    {
      id: "channel",
      name: "Open the channel",
      summary: "My Kanta is one channel and it does not reach everyone. The fallback is set up before the first send, not after the complaints.",
      steps: [
        {
          id: "channel-kanta",
          title: "Register the message template with Kanta",
          detail:
            "Kela has to accept the template, the sender identity and the send schedule before My Kanta will carry it. This is a lead-time item and the usual reason a campaign slips.",
          func: "communications",
          counterparties: [ORG.kanta, ORG.kela],
          durationDays: 10,
          output: "Approved Kanta template and send window",
          gate: "Kela's approval is the long pole — start it in parallel with drafting.",
          level: "regional",
        },
        {
          id: "channel-fallback",
          title: lowBandwidth ? "Set up SMS and voice as the primary fallback" : "Set up the non-digital fallback",
          detail: lowBandwidth
            ? "Where fast home broadband is thin, an app push is the wrong default. Contract the SMS gateway and the voice-narrated line, and treat Kanta as the secondary channel rather than the first."
            : "Suomi.fi Messages for those who have activated it, and a printed letter through Posti for everyone who has not. Roughly a fifth of any invited cohort is only reachable on paper.",
          func: "logistics",
          counterparties: lowBandwidth ? [ORG.traficom, ORG.posti] : [ORG.dvv, ORG.posti],
          durationDays: 6,
          output: "Fallback channel contracted and tested",
          level: "regional",
        },
        {
          id: "channel-access",
          title: "Accessibility conformance check",
          detail:
            "The Act on the Provision of Digital Services applies to this message. Screen-reader order, contrast and plain-language level are checked before send, because a failed check after send means re-sending to the whole cohort.",
          func: "communications",
          counterparties: [],
          durationDays: 2,
          output: "Accessibility statement for the campaign",
          level: "regional",
        },
      ],
    },
    {
      id: "deliver",
      name: "Send and watch",
      summary: "A pilot before the full wave, so a wrong link costs 300 people rather than 30 000.",
      steps: [
        {
          id: "deliver-pilot",
          title: "Pilot wave to 10% of the cohort",
          detail:
            "One municipality, one week. Measures deliverability, bounce rate and booking conversion before the rest of the cohort is committed.",
          func: "screening_lead",
          counterparties: [ORG.kanta],
          durationDays: 7,
          output: "Pilot results with a go / no-go",
          gate: "Full send is blocked until the pilot's booking conversion is read.",
          level: "regional",
        },
        {
          id: "deliver-full",
          title: "Full send in scheduled waves",
          detail:
            "Staged across weeks so the booking system and the screening sites absorb the demand the message creates — a successful campaign that nobody can get an appointment from is a failure.",
          func: "screening_lead",
          counterparties: [ORG.kanta, ORG.posti],
          durationDays: 14,
          output: "Full cohort contacted, by channel",
          level: "regional",
        },
        {
          id: "deliver-monitor",
          title: "Report attendance back to the national programme",
          detail:
            "Attendance re-measured against the Region's baseline and fed to the screening register, which is how the State's own indicator moves and how this directive eventually closes.",
          func: "data_analyst",
          counterparties: [ORG.registry, ORG.thl, ORG.stm],
          durationDays: 21,
          output: "Attendance delta reported to THL and STM",
          level: "regional",
        },
      ],
    },
  ];
}

function stakeholderChain(action: CandidateAction, regionName: string): PlaybookPhase[] {
  const logistics = action.id === "mobile-screening";

  if (logistics) {
    return [
      {
        id: "demand",
        name: "Locate the demand",
        summary: "Before buying a van, find out where the people who are not attending actually live.",
        steps: [
          {
            id: "demand-map",
            title: "Map non-attendance against travel distance",
            detail:
              "Attendance by municipality from the screening register, set against the distance to the nearest screening site and this Region's own Kela travel-reimbursement claims. Identifies the municipalities where distance is the binding constraint rather than the assumed one.",
            func: "data_analyst",
            counterparties: [ORG.registry, ORG.kela],
            durationDays: 5,
            output: "Ranked list of target municipalities",
            level: "regional",
          },
        ],
      },
      {
        id: "procure",
        name: "Procure the capacity",
        summary: "A mobile unit or a transport partnership is a purchase, and above the threshold it is a public one.",
        steps: [
          {
            id: "procure-option",
            title: "Cost the mobile unit against a transport subsidy",
            detail:
              "Two routes to the same outcome: bring the screening to the resident, or pay for the resident's journey. Costed per additional attendance so the choice is made on effect, not on which is easier to buy.",
            func: "finance",
            counterparties: [ORG.kela],
            durationDays: 7,
            output: "Options appraisal with cost per additional attendance",
            level: "regional",
          },
          {
            id: "procure-notice",
            title: "Run the procurement",
            detail:
              "Above the EU threshold this is a Hilma notice with its own statutory timetable, and that timetable — not the clinical work — sets when the first van can move.",
            func: "finance",
            counterparties: [ORG.hilma],
            durationDays: 30,
            output: "Awarded contract",
            gate: "The procurement timetable is statutory and cannot be compressed.",
            level: "regional",
          },
        ],
      },
      {
        id: "sites",
        name: "Secure the sites",
        summary: "A van needs somewhere to park, power, and a radiographer rota.",
        steps: [
          {
            id: "sites-agree",
            title: "Agree sites and access with each municipality",
            detail:
              "Parking, power, waste handling and a waiting space that is private enough for a screening appointment. Agreed per municipality, because each one owns its own sites.",
            func: "logistics",
            counterparties: [municipalities(regionName)],
            durationDays: 14,
            output: "Signed site agreements",
            level: "regional",
          },
          {
            id: "sites-staff",
            title: "Build the rota and confirm clinical cover",
            detail:
              "Radiographer and clinical cover for every scheduled stop, including the reporting capacity for the images the unit produces — the bottleneck is usually reading, not scanning.",
            func: "chief_physician",
            counterparties: [],
            durationDays: 10,
            output: "Confirmed rota and reporting capacity",
            gate: "No stop is published without confirmed reading capacity behind it.",
            level: "regional",
          },
        ],
      },
      {
        id: "run",
        name: "Publish and run",
        summary: "The schedule only works if the people it was built for know it exists.",
        steps: [
          {
            id: "run-invite",
            title: "Publish the schedule and invite the affected cohort",
            detail:
              "Per-stop invitations through Kanta with a paper fallback, timed so each municipality hears about its own date rather than the whole Region hearing about all of them.",
            func: "communications",
            counterparties: [ORG.kanta, ORG.posti],
            durationDays: 7,
            output: "Published schedule, cohort invited per stop",
            level: "regional",
          },
          {
            id: "run-monitor",
            title: "Report attendance uplift per stop",
            detail:
              "Attendance per municipality before and after, reported to the screening register — which is what tells the State whether the van worked or merely moved.",
            func: "data_analyst",
            counterparties: [ORG.registry, ORG.thl, ORG.stm],
            durationDays: 21,
            output: "Per-municipality attendance delta",
            level: "regional",
          },
        ],
      },
    ];
  }

  return [
    {
      id: "owner",
      name: "Find the accountable owner",
      summary: "A message to an institution is not a message to anyone. This step ends with a named person.",
      steps: [
        {
          id: "owner-identify",
          title: "Name the accountable director and the deciding body",
          detail: `The service-line director who can change the thing, and the ${regionName} board that has to fund it. A directive addressed to the county in general is one nobody has to answer.`,
          func: "screening_lead",
          counterparties: [county(regionName), board(regionName)],
          durationDays: 2,
          output: "Named owner and deciding body",
          level: "regional",
        },
      ],
    },
    {
      id: "assess",
      name: "Establish what is actually constraining it",
      summary: "The national data says there is a Gap. Only the Region can say what is causing it.",
      steps: [
        {
          id: "assess-capacity",
          title: "Capacity and scheduling review",
          detail:
            "Staffed slots against referrals received, by month, for the service in question. Separates a staffing shortfall from a scheduling one — they look identical in the national figures and need opposite fixes.",
          func: "chief_physician",
          counterparties: [],
          durationDays: 10,
          output: "Capacity review with the binding constraint named",
          level: "regional",
        },
        {
          id: "assess-cost",
          title: "Cost the realistic options",
          detail:
            "What closing the Gap would take, in posts and euros, against what the county currently has. Produces the number the board actually needs in order to decide.",
          func: "finance",
          counterparties: [board(regionName)],
          durationDays: 7,
          output: "Costed options for the board",
          level: "regional",
        },
      ],
    },
    {
      id: "commit",
      name: "Get a decision on the record",
      summary: "The point at which the Region either commits to a remedy or formally says it cannot.",
      steps: [
        {
          id: "commit-board",
          title: "Take the remedial plan to the county board",
          detail:
            "A dated plan with milestones, or a documented statement of why the Gap cannot be closed with current resources — which is itself a useful answer, and the one that justifies national action.",
          func: "screening_lead",
          counterparties: [board(regionName), ORG.stm],
          durationDays: 14,
          output: "Board decision: remedial plan or a declared constraint",
          gate: "The State's response window closes here.",
          level: "regional",
        },
      ],
    },
    {
      id: "oversee",
      name: "Close the loop",
      summary: "What happens if the response does not come, written down in advance.",
      steps: [
        {
          id: "oversee-report",
          title: "Report progress against the milestones",
          detail:
            "Monthly against the plan's own milestones, into the national monitoring — so the State sees movement rather than having to ask for it.",
          func: "screening_lead",
          counterparties: [ORG.thl, ORG.stm],
          durationDays: 30,
          output: "Monthly progress against milestones",
          level: "regional",
        },
        {
          id: "oversee-escalate",
          title: "Escalation path if the window closes unmet",
          detail:
            "If no plan arrives and no constraint is declared, supervision moves to the regional state administrative agency, and from there to Valvira. Stated at the start so it is a known consequence rather than a surprise.",
          func: "screening_lead",
          counterparties: [ORG.avi, ORG.valvira],
          durationDays: 5,
          output: "Escalation recorded, or closed as not needed",
          level: "state",
        },
      ],
    },
  ];
}

/** The full chain for an action in a Region, national mandate first. */
export function buildPlaybook(
  action: CandidateAction,
  regionName: string,
  lang: Lang = "en",
): PlaybookPhase[] {
  const body =
    action.workflow.type === "patient_message"
      ? patientMessageChain(action, regionName)
      : stakeholderChain(action, regionName);
  const phases = [mandatePhase(regionName), ...body];
  const profile = action.workflow.type === "patient_message" ? action.workflow.profile : "the invited population";
  return localizePhases(phases, lang, { region: regionName, profile: profileFi(profile, lang) });
}

export function allSteps(phases: PlaybookPhase[]): PlaybookStep[] {
  return phases.flatMap((p) => p.steps);
}

/** Phases run in sequence, steps inside a phase in parallel — so the chain's
 *  length is the sum of its slowest steps, which is the number a decision
 *  maker needs when they ask "when does this actually land?". */
export function criticalPathDays(phases: PlaybookPhase[]): number {
  return phases.reduce((sum, p) => sum + Math.max(0, ...p.steps.map((s) => s.durationDays)), 0);
}

/** Earliest start/end day for every step, given phases in sequence. */
export function schedule(phases: PlaybookPhase[]): Map<string, { start: number; end: number }> {
  const out = new Map<string, { start: number; end: number }>();
  let cursor = 0;
  for (const phase of phases) {
    for (const step of phase.steps) {
      out.set(step.id, { start: cursor, end: cursor + step.durationDays });
    }
    cursor += Math.max(0, ...phase.steps.map((s) => s.durationDays));
  }
  return out;
}

export function uniqueCounterparties(phases: PlaybookPhase[]): Counterparty[] {
  const seen = new Map<string, Counterparty>();
  for (const step of allSteps(phases)) {
    for (const c of step.counterparties) if (!seen.has(c.name)) seen.set(c.name, c);
  }
  return [...seen.values()];
}
