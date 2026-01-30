# NextMed Database Schema & Seed Data

## Overview
This database schema is designed for a high-performance medical reasoning application targeting UK medical students preparing for the **UKMLA (UK Medical Licensing Assessment)**.

## Schema Architecture

### 1. **users** Table
Stores user authentication data (Clerk User IDs)
- `id` (text, PK): Clerk User ID
- `email` (text, not null)
- `role` (enum: 'student' | 'admin', default: 'student')
- `created_at` (timestamp)

### 2. **cases** Table
Medical scenarios (e.g., "Acute Chest Pain in 45M")
- `id` (serial, PK)
- `title` (text): Case title
- `description` (text): Brief summary
- `clinical_domain` (text): e.g., "Cardiology", "Respiratory"
- `difficulty_level` (enum: 'Foundation' | 'Core' | 'Advanced')
- `is_published` (boolean, default: false)
- `created_at` / `updated_at` (timestamps)

### 3. **case_stages** Table
Time-based steps within a case (e.g., History → Examination → Investigation → Management)
- `id` (serial, PK)
- `case_id` (integer, FK to cases, cascade delete)
- `stage_order` (integer): Sequence number (1, 2, 3...)
- `narrative` (text): Main scenario text
- `clinical_data` (jsonb): **Flexible vitals storage** (BP, HR, labs, notes, etc.)
- `media_url` (text): Optional X-rays, ECG images
- `created_at` (timestamp)
- **Index**: `case_stages_case_id_idx` on `case_id`

### 4. **stage_options** Table
Decision points for each stage (multiple choice options)
- `id` (serial, PK)
- `stage_id` (integer, FK to case_stages, cascade delete)
- `text` (text): The choice text (e.g., "Administer 5mg Morphine")
- `is_correct` (boolean)
- `score_weight` (integer, default: 0): **Nuanced scoring**
  - `+2`: Optimal/gold-standard answer
  - `+1`: Safe but suboptimal
  - `0`: Neutral
  - `-1 to -3`: Incorrect with varying severity
  - `-4 to -5`: Dangerous/potentially fatal
- `feedback` (text): Immediate explanation after selection
- `created_at` (timestamp)
- **Index**: `stage_options_stage_id_idx` on `stage_id`

## Seeded Data

### 5 Real-World UKMLA-Style Cases

#### 1. **Acute Chest Pain - STEMI** (Cardiology, Advanced)
- **3 Stages**: Initial Presentation → ECG Results → Post-PCI Care
- **12 Options total**
- Covers: ECG interpretation, PPCI vs thrombolysis, BASH secondary prevention

#### 2. **Sepsis Management** (Critical Care, Advanced)
- **2 Stages**: Initial Assessment → Fluid Resuscitation Failure
- **8 Options total**
- Covers: Sepsis Six bundle, vasopressor escalation, fluid overload risks

#### 3. **Anaphylaxis** (Emergency Medicine, Core)
- **2 Stages**: Acute Reaction → Inadequate Response to First Dose
- **8 Options total**
- Covers: IM Adrenaline administration, repeat dosing, Resuscitation Council UK guidelines

#### 4. **Diabetic Ketoacidosis** (Endocrinology, Core)
- **2 Stages**: DKA Diagnosis → Ongoing Management
- **8 Options total**
- Covers: FRIII protocol, potassium replacement, dextrose addition, JBDS guidelines

#### 5. **Acute Asthma Exacerbation** (Respiratory, Foundation)
- **2 Stages**: Severity Classification → Response Assessment
- **8 Options total**
- Covers: BTS SIGN guidelines, discharge criteria, escalation triggers

## Database Statistics
- **Total Cases**: 5
- **Total Stages**: 11
- **Total Options**: 44 (Average: 4 options per stage)
- **Scoring Range**: -5 (fatal error) to +2 (optimal management)

## Usage

### Push Schema to Database
```bash
npx drizzle-kit push
```

### Seed Database with UKMLA Cases
```bash
npx tsx src/db/seed.ts
```

### Query and Verify Data
```bash
npx tsx src/db/query.ts
```

### Example Query (Using Drizzle Relations)
```typescript
import { db } from './db';

// Get a case with all stages and options
const caseWithStages = await db.query.cases.findFirst({
  where: eq(cases.id, 1),
  with: {
    stages: {
      with: {
        options: true
      }
    }
  }
});
```

## Clinical Data JSONB Structure
The `clinical_data` field stores flexible patient data:

```typescript
{
  // Vital Signs
  BP: "120/80",
  HR: 99,
  RR: 18,
  SpO2: 96,
  Temp: 36.8,
  
  // Investigations
  ECG: "Inferior STEMI (ST elevation leads II, III, aVF)",
  
  // Labs
  labs: {
    lactate: "4.2 mmol/L",
    troponin: "12450 ng/L",
    pH: "7.12"
  },
  
  // Clinical Notes
  notes: [
    "Patient diaphoretic",
    "Kussmaul breathing pattern"
  ]
}
```

## Guidelines Referenced
All cases follow current UK clinical guidelines:
- **NICE CG167** (Acute Coronary Syndromes)
- **Surviving Sepsis Campaign 2021**
- **Resuscitation Council UK** (Anaphylaxis, ALS)
- **JBDS** (Joint British Diabetes Societies for DKA)
- **BTS/SIGN** (British Thoracic Society Asthma Guidelines)

## Future Enhancements
- Add user progress tracking table (`user_attempts`)
- Implement case difficulty auto-adjustment based on performance
- Add timer-based scoring for time-critical scenarios
- Include multimedia support (ECG images, X-rays, auscultation sounds)
- Add peer-reviewed case submissions from medical educators

---

**Built for NextMed** | Medical Reasoning Application for UKMLA Students
