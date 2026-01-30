# NextMed Database Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NEXTMED DATABASE SCHEMA                            │
│                     Medical Reasoning App for UKMLA Students                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐
│     users        │
├──────────────────┤
│ id (text) PK     │ ◄── Clerk User ID
│ email            │
│ role             │ ◄── 'student' | 'admin'
│ created_at       │
└──────────────────┘
        │
        │ (Future: user_attempts table)
        │
        ▼

┌──────────────────────────┐
│        cases             │ ◄── Medical Scenarios
├──────────────────────────┤
│ id (serial) PK           │
│ title                    │ ◄── "Acute Chest Pain in 62M"
│ description              │
│ clinical_domain          │ ◄── "Cardiology", "Respiratory"
│ difficulty_level         │ ◄── 'Foundation' | 'Core' | 'Advanced'
│ is_published (bool)      │
│ created_at               │
│ updated_at               │
└──────────────────────────┘
        │
        │ 1:N relationship
        │ ON DELETE CASCADE
        ▼
┌──────────────────────────┐
│     case_stages          │ ◄── Time-based Steps
├──────────────────────────┤
│ id (serial) PK           │
│ case_id (FK) ───────────►│ cases.id
│ stage_order              │ ◄── Sequencing (1, 2, 3...)
│ narrative                │ ◄── Scenario text
│ clinical_data (jsonb)    │ ◄── { BP, HR, labs, notes, ECG... }
│ media_url                │ ◄── Optional: X-rays, ECG images
│ created_at               │
│                          │
│ INDEX: case_id           │ ◄── Performance optimization
└──────────────────────────┘
        │
        │ 1:N relationship
        │ ON DELETE CASCADE
        ▼
┌──────────────────────────┐
│   stage_options          │ ◄── Decision Points
├──────────────────────────┤
│ id (serial) PK           │
│ stage_id (FK) ──────────►│ case_stages.id
│ text                     │ ◄── "Administer 5mg Morphine"
│ is_correct (bool)        │
│ score_weight             │ ◄── -5 to +2 (nuanced scoring)
│ feedback                 │ ◄── Immediate explanation
│ created_at               │
│                          │
│ INDEX: stage_id          │ ◄── Performance optimization
└──────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════

SCORING SYSTEM:
  +2  = Optimal/Gold-standard answer (e.g., "IM Adrenaline for anaphylaxis")
  +1  = Safe but suboptimal (e.g., "IV fluids but missing vasopressors")
   0  = Neutral
  -1  = Minor error (e.g., "Delayed troponin instead of ECG first")
  -2  = Moderate error (e.g., "Unnecessary high-flow O2")
  -3  = Significant error (e.g., "Wrong drug choice")
  -4  = Dangerous error (e.g., "IV insulin bolus in DKA")
  -5  = Potentially fatal (e.g., "Discharge acute severe asthma")

═══════════════════════════════════════════════════════════════════════════════

CLINICAL DATA JSONB STRUCTURE:
{
  // Vital Signs
  "BP": "120/80",
  "HR": 99,
  "RR": 18,
  "SpO2": 96,
  "Temp": 36.8,
  
  // Investigations
  "ECG": "Inferior STEMI (ST elevation leads II, III, aVF)",
  "peak_flow": "40% of predicted",
  "capillary_glucose": "28.4 mmol/L",
  
  // Labs
  "labs": {
    "lactate": "4.2 mmol/L",
    "troponin": "12450 ng/L",
    "pH": "7.12",
    "K+": "5.8"
  },
  
  // Clinical Notes
  "notes": [
    "Patient diaphoretic",
    "Kussmaul breathing pattern",
    "Family history: Father died of MI age 58"
  ]
}

═══════════════════════════════════════════════════════════════════════════════

DATABASE STATS:
  Total Tables:      4
  Total Indexes:     4 (2 FK indexes + 2 Primary Keys)
  Total Cases:       5
  Total Stages:      11
  Total Options:     44
  Avg Options/Stage: 4.0

═══════════════════════════════════════════════════════════════════════════════

DRIZZLE RELATIONS (For Nested Queries):

// Query example:
const caseWithStages = await db.query.cases.findFirst({
  where: eq(cases.id, 1),
  with: {
    stages: {
      orderBy: (stages, { asc }) => [asc(stages.stageOrder)],
      with: {
        options: true
      }
    }
  }
});

Result structure:
{
  id: 1,
  title: "Acute Chest Pain in 62-Year-Old Male",
  clinicalDomain: "Cardiology",
  stages: [
    {
      id: 1,
      stageOrder: 1,
      narrative: "A 62-year-old man presents...",
      clinicalData: { BP: "168/102", HR: 108, ... },
      options: [
        { id: 1, text: "Perform 12-lead ECG...", isCorrect: true, scoreWeight: 2 },
        { id: 2, text: "Order chest X-ray...", isCorrect: false, scoreWeight: -3 },
        ...
      ]
    },
    ...
  ]
}

═══════════════════════════════════════════════════════════════════════════════
```
