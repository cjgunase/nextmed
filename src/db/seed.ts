import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { users, cases, caseStages, stageOptions } from './schema';
import { sql } from 'drizzle-orm';

// Load environment variables
config({ path: '.env.local' });

const connection = neon(process.env.DATABASE_URL!);
const db = drizzle(connection);

async function main() {
    console.log('🌱 Starting seed process...');

    // Drop existing tables in correct order (respecting foreign keys)
    console.log('🗑️  Dropping existing tables...');
    await db.execute(sql`DROP TABLE IF EXISTS stage_options CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS case_stages CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS cases CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS users CASCADE`);

    // Create tables
    console.log('📦 Creating tables...');
    await db.execute(sql`
    CREATE TABLE users (
      id text PRIMARY KEY NOT NULL,
      email text NOT NULL,
      role text DEFAULT 'student' NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `);

    await db.execute(sql`
    CREATE TABLE cases (
      id serial PRIMARY KEY NOT NULL,
      user_id text NOT NULL,
      title text NOT NULL,
      description text NOT NULL,
      clinical_domain text NOT NULL,
      difficulty_level text NOT NULL,
      is_published boolean DEFAULT false NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL,
      updated_at timestamp DEFAULT now() NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

    await db.execute(sql`
    CREATE TABLE case_stages (
      id serial PRIMARY KEY NOT NULL,
      case_id integer NOT NULL,
      stage_order integer NOT NULL,
      narrative text NOT NULL,
      clinical_data jsonb,
      media_url text,
      created_at timestamp DEFAULT now() NOT NULL,
      FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    )
  `);

    await db.execute(sql`
    CREATE TABLE stage_options (
      id serial PRIMARY KEY NOT NULL,
      stage_id integer NOT NULL,
      text text NOT NULL,
      is_correct boolean DEFAULT false NOT NULL,
      score_weight integer DEFAULT 0 NOT NULL,
      feedback text NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL,
      FOREIGN KEY (stage_id) REFERENCES case_stages(id) ON DELETE CASCADE
    )
  `);

    // Create indexes
    await db.execute(sql`CREATE INDEX case_stages_case_id_idx ON case_stages(case_id)`);
    await db.execute(sql`CREATE INDEX stage_options_stage_id_idx ON stage_options(stage_id)`);

    console.log('✅ Tables created successfully');

    // Insert sample users
    console.log('👤 Seeding users...');
    await db.insert(users).values([
        {
            id: 'user_38zNKdM9PQvaMhsqkljCfE7R4W7',
            email: 'student@nextmed.app',
            role: 'student',
        },
        {
            id: 'user_2admin456',
            email: 'admin@ukmla.ac.uk',
            role: 'admin',
        },
    ]);

    // ============================================================================
    // CASE 1: Acute Chest Pain - STEMI (Cardiology, Advanced)
    // ============================================================================
    console.log('🏥 Seeding Case 1: Acute Chest Pain - STEMI...');

    const [case1] = await db.insert(cases).values({
        userId: 'user_38zNKdM9PQvaMhsqkljCfE7R4W7', // Assign to specific student user
        title: 'Acute Chest Pain in 62-Year-Old Male',
        description: 'A 62-year-old man presents to A&E with sudden-onset crushing chest pain radiating to his left arm and jaw. Past medical history of HTN, Type 2 DM, and 40 pack-year smoking history.',
        clinicalDomain: 'Cardiology',
        difficultyLevel: 'Advanced',
        isPublished: true,
    }).returning();

    // Stage 1: Initial Presentation
    const [stage1_1] = await db.insert(caseStages).values({
        caseId: case1.id,
        stageOrder: 1,
        narrative: 'A 62-year-old man presents at 02:00 with severe central chest pain that started 45 minutes ago while watching TV. The pain is described as "crushing" and radiates to his left jaw and arm. He is visibly distressed, sweating profusely, and nauseated. Past medical history: Hypertension (poorly controlled), Type 2 Diabetes Mellitus, and is a current smoker (40 pack-years). Medications: Metformin 1g BD, Ramipril 5mg OD.',
        clinicalData: {
            BP: '168/102',
            HR: 108,
            RR: 22,
            SpO2: 96,
            Temp: 36.8,
            notes: ['Patient diaphoretic', 'Anxious and clutching chest', 'Family history: Father died of MI age 58'],
        },
    }).returning();

    await db.insert(stageOptions).values([
        {
            stageId: stage1_1.id,
            text: 'Perform 12-lead ECG immediately',
            isCorrect: true,
            scoreWeight: 2,
            feedback: 'Correct! In suspected ACS, a 12-lead ECG must be performed within 10 minutes of arrival to identify STEMI. This is the most critical initial investigation.',
        },
        {
            stageId: stage1_1.id,
            text: 'Order chest X-ray and await results before ECG',
            isCorrect: false,
            scoreWeight: -3,
            feedback: 'Incorrect. ECG takes priority over chest X-ray in suspected MI. Delaying ECG could delay critical reperfusion therapy (PPCI or thrombolysis). Time is myocardium!',
        },
        {
            stageId: stage1_1.id,
            text: 'Administer GTN spray and reassess in 15 minutes',
            isCorrect: false,
            scoreWeight: -2,
            feedback: 'Partially incorrect. While GTN can be given, you must not delay ECG. GTN may relieve stable angina but will not alter STEMI management. ECG is the immediate priority.',
        },
        {
            stageId: stage1_1.id,
            text: 'Request urgent troponin levels first',
            isCorrect: false,
            scoreWeight: -1,
            feedback: 'Incorrect. Troponins take time to rise (3-6 hours post-infarct) and should not delay ECG. High-sensitivity troponin is part of workup but ECG identifies STEMI immediately.',
        },
    ]);

    // Stage 2: ECG Results
    const [stage1_2] = await db.insert(caseStages).values({
        caseId: case1.id,
        stageOrder: 2,
        narrative: 'ECG shows ST-elevation of 3mm in leads II, III, and aVF, with reciprocal ST-depression in aVL. This confirms an acute inferior STEMI. The patient continues to have chest pain (9/10). You have given Aspirin 300mg chewed and activated the cardiac catheterisation lab. The nearest PPCI centre is 20 minutes away.',
        clinicalData: {
            BP: '155/95',
            HR: 102,
            pain_score: 9,
            ECG: 'Inferior STEMI (ST elevation leads II, III, aVF)',
            notes: ['Catheter lab ETA: 90 minutes from door-to-balloon'],
        },
    }).returning();

    await db.insert(stageOptions).values([
        {
            stageId: stage1_2.id,
            text: 'Administer dual antiplatelet therapy (Ticagrelor 180mg) + IV morphine for pain',
            isCorrect: true,
            scoreWeight: 2,
            feedback: 'Optimal! Ticagrelor (or Clopidogrel 600mg) is indicated in STEMI for dual antiplatelet therapy. Morphine controls pain and reduces sympathetic drive. Well done following NICE CG167.',
        },
        {
            stageId: stage1_2.id,
            text: 'Give thrombolysis (Tenecteplase) immediately',
            isCorrect: false,
            scoreWeight: -5,
            feedback: 'Incorrect. Thrombolysis is only indicated if PPCI cannot be delivered within 120 minutes of diagnosis. You have activated the lab and ETA is 90 minutes. PPCI is superior to thrombolysis when available.',
        },
        {
            stageId: stage1_2.id,
            text: 'Administer high-dose oxygen (15L via non-rebreather mask)',
            isCorrect: false,
            scoreWeight: -2,
            feedback: 'Incorrect. The patient\'s SpO2 is 96% (target >94%). Routine high-flow oxygen is not indicated in MI unless hypoxic (SpO2 <94%). Hyperoxia may worsen outcomes (AVOID trial).',
        },
        {
            stageId: stage1_2.id,
            text: 'Start IV beta-blocker (Metoprolol) for heart rate control',
            isCorrect: false,
            scoreWeight: -3,
            feedback: 'Dangerous in acute phase! IV beta-blockers are contraindicated in acute STEMI as they can precipitate cardiogenic shock. Oral beta-blockers are started post-reperfusion (24-48hrs).',
        },
    ]);

    // Stage 3: Post-PCI Care
    const [stage1_3] = await db.insert(caseStages).values({
        caseId: case1.id,
        stageOrder: 3,
        narrative: 'The patient undergoes successful PPCI with a drug-eluting stent to the right coronary artery (RCA). He is now pain-free and haemodynamically stable on the Coronary Care Unit. You are planning his secondary prevention discharge medications.',
        clinicalData: {
            BP: '128/78',
            HR: 72,
            pain_score: 0,
            procedure: 'Successful PPCI to RCA with DES',
            notes: ['No complications post-PCI', 'Troponin-I peak: 12,450 ng/L'],
        },
    }).returning();

    await db.insert(stageOptions).values([
        {
            stageId: stage1_3.id,
            text: 'Prescribe "BASH": Beta-blocker, ACE-inhibitor, Statin, and dual antiplatelets (Aspirin + Ticagrelor)',
            isCorrect: true,
            scoreWeight: 2,
            feedback: 'Excellent! This is the mnemonic for post-MI secondary prevention: Beta-blocker (e.g., Bisoprolol), ACE-inhibitor (e.g., Ramipril 10mg), high-intensity Statin (Atorvastatin 80mg), and dual antiplatelets for 12 months.',
        },
        {
            stageId: stage1_3.id,
            text: 'Discontinue Aspirin and use Ticagrelor monotherapy',
            isCorrect: false,
            scoreWeight: -4,
            feedback: 'Incorrect. After PCI with stenting, dual antiplatelet therapy (DAPT) is mandatory for 12 months to prevent stent thrombosis. Stopping Aspirin significantly increases this risk.',
        },
        {
            stageId: stage1_3.id,
            text: 'Start Warfarin for stroke prevention',
            isCorrect: false,
            scoreWeight: -2,
            feedback: 'Incorrect. Warfarin is not indicated for post-MI unless there is another indication (e.g., AF, LV thrombus). The standard is dual antiplatelets, not anticoagulation.',
        },
        {
            stageId: stage1_3.id,
            text: 'Avoid statins due to risk of rhabdomyolysis',
            isCorrect: false,
            scoreWeight: -5,
            feedback: 'Dangerous misconception! High-intensity statins (Atorvastatin 80mg) are mandated post-ACS regardless of cholesterol levels. They reduce mortality by 25%. Rhabdomyolysis risk is <0.1%.',
        },
    ]);

    // ============================================================================
    // CASE 2: Sepsis in Emergency Department (Critical Care, Advanced)
    // ============================================================================
    console.log('🏥 Seeding Case 2: Sepsis Management...');

    const [case2] = await db.insert(cases).values({
        userId: 'user_38zNKdM9PQvaMhsqkljCfE7R4W7', // Assign to specific student user
        title: 'Acute Confusion and Hypotension in 78-Year-Old Female',
        description: 'A 78-year-old nursing home resident presents with 3-day history of reduced oral intake, confusion, and a productive cough. She is hypotensive and tachycardic.',
        clinicalDomain: 'Critical Care',
        difficultyLevel: 'Advanced',
        isPublished: true,
    }).returning();

    const [stage2_1] = await db.insert(caseStages).values({
        caseId: case2.id,
        stageOrder: 1,
        narrative: 'A 78-year-old woman is brought by ambulance from her care home. Staff report she has been "not herself" for 3 days with reduced food/fluid intake. This morning she became drowsy and confused. She has a productive cough with green sputum. Past medical history: COPD (on home oxygen 2L), CKD Stage 3, T2DM. On examination: GCS 13/15 (E4 V3 M6), appears dehydrated, respiratory distress with coarse crackles right base.',
        clinicalData: {
            BP: '82/54',
            HR: 128,
            RR: 32,
            SpO2: 88,
            Temp: 38.9,
            GCS: 13,
            labs: {
                lactate: '4.2 mmol/L',
                WCC: '19.2',
                CRP: '245',
                'Urea': '18.4',
                'Creatinine': '178',
            },
            notes: ['Urine dipstick: Negative', 'CXR pending'],
        },
    }).returning();

    await db.insert(stageOptions).values([
        {
            stageId: stage2_1.id,
            text: 'Initiate Sepsis Six pathway immediately: Blood cultures, IV antibiotics within 1 hour, IV fluid resuscitation',
            isCorrect: true,
            scoreWeight: 2,
            feedback: 'Correct! This patient meets SOFA criteria for sepsis (lactate >2, hypotension, confusion). Sepsis Six must start within the "golden hour": Take 3 (cultures, lactate, urine output), Give 3 (oxygen, fluids, antibiotics).',
        },
        {
            stageId: stage2_1.id,
            text: 'Start empirical antibiotics but wait for CXR and blood culture results before giving fluids',
            isCorrect: false,
            scoreWeight: -4,
            feedback: 'Dangerous delay! Septic shock requires immediate fluid resuscitation (500ml bolus over 15 mins). Waiting for investigations before fluids violates Surviving Sepsis Campaign guidelines and worsens mortality.',
        },
        {
            stageId: stage2_1.id,
            text: 'Give 15L oxygen via non-rebreather mask to improve SpO2',
            isCorrect: false,
            scoreWeight: -2,
            feedback: 'Risky in COPD! This patient is a Type 2 respiratory failure risk (CO2 retainer). Target SpO2 88-92% with controlled oxygen (e.g., 28% Venturi mask). High-flow O2 may precipitate hypercapnic respiratory failure.',
        },
        {
            stageId: stage2_1.id,
            text: 'Assume this is a COPD exacerbation and start nebulisers + steroids first',
            isCorrect: false,
            scoreWeight: -5,
            feedback: 'Potentially fatal error. The patient has septic shock (hypotension, lactate 4.2, fever, confusion). Treating as isolated COPD exacerbation without addressing sepsis will lead to multi-organ failure.',
        },
    ]);

    const [stage2_2] = await db.insert(caseStages).values({
        caseId: case2.id,
        stageOrder: 2,
        narrative: 'You have started the Sepsis Six bundle. Blood cultures taken, and you administered Co-amoxiclav 1.2g IV and a 500ml crystalloid bolus. CXR shows right lower lobe consolidation confirming community-acquired pneumonia. After 1L fluid resuscitation, BP is now 90/60, HR 118. Urine output is only 10ml in the first hour.',
        clinicalData: {
            BP: '90/60',
            HR: 118,
            urine_output: '10ml/hr',
            fluid_given: '1000ml',
            notes: ['CXR: Right lower lobe consolidation', 'Escalate to senior?'],
        },
    }).returning();

    await db.insert(stageOptions).values([
        {
            stageId: stage2_2.id,
            text: 'Escalate to ICU for vasopressor support (Noradrenaline) - target MAP ≥65mmHg',
            isCorrect: true,
            scoreWeight: 2,
            feedback: 'Correct! Persistent hypotension after 2L fluid resuscitation indicates septic shock requiring vasopressors. Noradrenaline is first-line (Surviving Sepsis 2021). Delay increases mortality.',
        },
        {
            stageId: stage2_2.id,
            text: 'Continue aggressive fluid resuscitation - give another 2L crystalloid rapidly',
            isCorrect: false,
            scoreWeight: -3,
            feedback: 'Risky! While initial resuscitation is crucial, giving >2-3L without response risks fluid overload, pulmonary oedema, and ARDS. This patient needs vasopressors, not more fluids alone.',
        },
        {
            stageId: stage2_2.id,
            text: 'Give furosemide IV to improve urine output',
            isCorrect: false,
            scoreWeight: -4,
            feedback: 'Dangerous! The oliguria is due to shock (poor renal perfusion), not fluid overload. Diuretics will worsen hypotension and renal failure. Restore circulating volume and perfusion first.',
        },
        {
            stageId: stage2_2.id,
            text: 'Insert urinary catheter to monitor output, but continue current management',
            isCorrect: false,
            scoreWeight: 1,
            feedback: 'Partially correct. Catheter insertion is appropriate for monitoring in sepsis. However, you have not addressed the ongoing shock state - vasopressors are still needed.',
        },
    ]);

    // ============================================================================
    // CASE 3: Anaphylaxis (Emergency Medicine, Core)
    // ============================================================================
    console.log('🏥 Seeding Case 3: Anaphylaxis...');

    const [case3] = await db.insert(cases).values({
        userId: 'user_38zNKdM9PQvaMhsqkljCfE7R4W7', // Assign to specific student user
        title: 'Acute Allergic Reaction Post-Antibiotic',
        description: 'A 34-year-old woman develops facial swelling, wheeze, and hypotension 10 minutes after first dose of amoxicillin for UTI.',
        clinicalDomain: 'Emergency Medicine',
        difficultyLevel: 'Core',
        isPublished: true,
    }).returning();

    const [stage3_1] = await db.insert(caseStages).values({
        caseId: case3.id,
        stageOrder: 1,
        narrative: 'A 34-year-old woman took her first dose of amoxicillin 500mg for a suspected UTI 10 minutes ago. She now complains of tingling lips, difficulty breathing, and "feeling faint." On examination: facial and tongue swelling, audible wheeze, and urticarial rash spreading across her chest. No known allergies documented. She appears distressed and is struggling to speak.',
        clinicalData: {
            BP: '88/52',
            HR: 136,
            RR: 28,
            SpO2: 91,
            notes: ['Facial/tongue angioedema', 'Widespread urticarial rash', 'Bilateral wheeze on auscultation'],
        },
    }).returning();

    await db.insert(stageOptions).values([
        {
            stageId: stage3_1.id,
            text: 'Administer IM Adrenaline 500 micrograms (0.5ml of 1:1000) immediately to anterolateral thigh',
            isCorrect: true,
            scoreWeight: 2,
            feedback: 'Life-saving! This is anaphylaxis (acute onset, airway/breathing/circulation compromise). IM Adrenaline is first-line and must be given immediately. Resuscitation Council UK: 500mcg IM for adults.',
        },
        {
            stageId: stage3_1.id,
            text: 'Give IV Hydrocortisone 200mg and IV Chlorphenamine 10mg first',
            isCorrect: false,
            scoreWeight: -4,
            feedback: 'Incorrect priority! Steroids and antihistamines are adjuncts only. They do NOT treat acute anaphylaxis. Adrenaline is the only life-saving drug and must be given first (within seconds/minutes).',
        },
        {
            stageId: stage3_1.id,
            text: 'Secure airway by preparing for emergency cricothyroidotomy',
            isCorrect: false,
            scoreWeight: -2,
            feedback: 'Premature! While airway protection may be needed, the immediate priority is IM Adrenaline to reverse bronchospasm and vasodilation. Cricothyroidotomy is a last resort if intubation fails after adrenaline.',
        },
        {
            stageId: stage3_1.id,
            text: 'Administer nebulised salbutamol for wheeze',
            isCorrect: false,
            scoreWeight: -3,
            feedback: 'Insufficient! Salbutamol helps bronchospasm but does NOT address the systemic histamine release and shock. Adrenaline is essential - it acts as bronchodilator AND vasoconstrictor.',
        },
    ]);

    const [stage3_2] = await db.insert(caseStages).values({
        caseId: case3.id,
        stageOrder: 2,
        narrative: 'You have given IM Adrenaline 500mcg and the patient is now on high-flow oxygen. After 5 minutes, her wheeze persists, BP is 92/58, and she remains tachycardic at 124bpm. The tongue swelling appears unchanged.',
        clinicalData: {
            BP: '92/58',
            HR: 124,
            SpO2: 94,
            time_since_adrenaline: '5 minutes',
            notes: ['Persistent wheeze', 'No improvement in angioedema'],
        },
    }).returning();

    await db.insert(stageOptions).values([
        {
            stageId: stage3_2.id,
            text: 'Repeat IM Adrenaline 500mcg (second dose) after 5 minutes - as per Resuscitation Council guidelines',
            isCorrect: true,
            scoreWeight: 2,
            feedback: 'Correct! Repeat IM Adrenaline every 5 minutes if inadequate response. Most patients need 2-3 doses. Continue monitoring and prepare for IV adrenaline infusion if refractory.',
        },
        {
            stageId: stage3_2.id,
            text: 'Switch to IV adrenaline bolus immediately',
            isCorrect: false,
            scoreWeight: -3,
            feedback: 'Risky without ICU/anaesthetist! IV adrenaline is reserved for refractory anaphylaxis with cardiac arrest or peri-arrest situations. Incorrect dosing can cause fatal arrhythmias. Continue IM dosing first.',
        },
        {
            stageId: stage3_2.id,
            text: 'Wait and observe for 10 more minutes before re-dosing adrenaline',
            isCorrect: false,
            scoreWeight: -5,
            feedback: 'Dangerous delay! Waiting risks complete airway obstruction or cardiovascular collapse. Repeat IM adrenaline is safe and indicated at 5-minute intervals until response.',
        },
        {
            stageId: stage3_2.id,
            text: 'Give IV fluids (500ml rapid bolus) instead of repeat adrenaline',
            isCorrect: false,
            scoreWeight: 1,
            feedback: 'Partially useful but insufficient. IV fluids support circulation but do NOT reverse the pathophysiology of anaphylaxis. Repeat adrenaline is the priority, with fluids as adjunct.',
        },
    ]);

    // ============================================================================
    // CASE 4: Diabetic Ketoacidosis (Endocrinology, Core)
    // ============================================================================
    console.log('🏥 Seeding Case 4: DKA...');

    const [case4] = await db.insert(cases).values({
        userId: 'user_38zNKdM9PQvaMhsqkljCfE7R4W7', // Assign to specific student user
        title: 'Vomiting and Abdominal Pain in Type 1 Diabetic',
        description: 'A 19-year-old with Type 1 diabetes presents with 2-day history of vomiting, abdominal pain, and polyuria. She stopped her insulin due to nausea.',
        clinicalDomain: 'Endocrinology',
        difficultyLevel: 'Core',
        isPublished: true,
    }).returning();

    const [stage4_1] = await db.insert(caseStages).values({
        caseId: case4.id,
        stageOrder: 1,
        narrative: 'A 19-year-old woman with Type 1 diabetes (diagnosed age 12, usually well-controlled on basal-bolus insulin) presents with severe nausea, vomiting, and diffuse abdominal pain for 48 hours. She states she has not taken her insulin for 2 days because "I thought I should not take it if I am not eating." She appears dehydrated with dry mucous membranes and Kussmaul breathing (deep, labored respirations).',
        clinicalData: {
            BP: '98/62',
            HR: 118,
            RR: 28,
            Temp: 37.2,
            capillary_glucose: '28.4 mmol/L',
            labs: {
                pH: '7.12',
                bicarbonate: '9 mmol/L',
                ketones: '5.4 mmol/L',
                'Na+': '132',
                'K+': '5.8',
                'Urea': '12.3',
                'Creatinine': '142',
            },
            notes: ['Kussmaul breathing pattern', 'Acetone smell on breath', 'Abdominal tenderness (generalized)'],
        },
    }).returning();

    await db.insert(stageOptions).values([
        {
            stageId: stage4_1.id,
            text: 'Diagnose DKA and start fixed-rate IV insulin infusion (FRIII) 0.1 units/kg/hr + IV 0.9% saline resuscitation',
            isCorrect: true,
            scoreWeight: 2,
            feedback: 'Excellent! DKA criteria met: Glucose >11, pH <7.3, ketones >3. JBDS guidelines: Start FRIII at 0.1u/kg/hr AND fluid resuscitation (1L 0.9% saline over 1hr initially). Critical to correct both hyperglycemia and acidosis.',
        },
        {
            stageId: stage4_1.id,
            text: 'Give IV insulin bolus (10 units stat) to rapidly lower glucose',
            isCorrect: false,
            scoreWeight: -4,
            feedback: 'Dangerous! IV insulin bolus risks precipitous glucose drop causing cerebral oedema (especially in young patients). JBDS mandates fixed-rate infusion (FRIII), not boluses.',
        },
        {
            stageId: stage4_1.id,
            text: 'Start oral rehydration and resume her normal subcutaneous insulin',
            isCorrect: false,
            scoreWeight: -5,
            feedback: 'Inadequate for DKA! Severe acidosis (pH 7.12) and vomiting preclude oral intake. IV insulin and fluids are mandatory. Subcutaneous insulin is ineffective in DKA due to poor absorption in shocked state.',
        },
        {
            stageId: stage4_1.id,
            text: 'Give IV bicarbonate to correct acidosis quickly',
            isCorrect: false,
            scoreWeight: -2,
            feedback: 'Not recommended! Bicarbonate is only considered if pH <6.9 or cardiac arrest. It can cause paradoxical CNS acidosis and hypokalaemia. Let insulin and fluids correct acidosis physiologically.',
        },
    ]);

    const [stage4_2] = await db.insert(caseStages).values({
        caseId: case4.id,
        stageOrder: 2,
        narrative: 'After 4 hours of FRIII and IV fluids, glucose is now 14.2 mmol/L, pH 7.22, and ketones 3.1 mmol/L. The patient feels less nauseated. Repeat labs show K+ is now 3.2 mmol/L.',
        clinicalData: {
            capillary_glucose: '14.2 mmol/L',
            labs: {
                pH: '7.22',
                ketones: '3.1 mmol/L',
                'K+': '3.2',
            },
            notes: ['Improving clinically', 'Tolerating sips of water'],
        },
    }).returning();

    await db.insert(stageOptions).values([
        {
            stageId: stage4_2.id,
            text: 'Add IV potassium replacement (40mmol/L in next bag) and start 10% dextrose infusion alongside saline',
            isCorrect: true,
            scoreWeight: 2,
            feedback: 'Perfect DKA management! K+ falls as acidosis corrects (insulin drives K+ intracellularly). Replace if K+ <5.5. Add 10% dextrose when glucose <14 to avoid hypoglycemia while continuing insulin (to clear ketones).',
        },
        {
            stageId: stage4_2.id,
            text: 'Stop insulin infusion now that glucose is improving',
            isCorrect: false,
            scoreWeight: -5,
            feedback: 'Fatal error! Glucose falls faster than ketones clear. Stopping insulin will rebound ketoacidosis. MUST continue FRIII until pH >7.3 AND ketones <0.6. Add dextrose to prevent hypoglycemia.',
        },
        {
            stageId: stage4_2.id,
            text: 'Ignore low potassium - it will self-correct as DKA resolves',
            isCorrect: false,
            scoreWeight: -4,
            feedback: 'Dangerous! Hypokalaemia (<3.5) during DKA treatment risks fatal arrhythmias. JBDS: Add 40mmol K+ per liter of IV fluid if K+ <5.5. Monitor K+ 2-hourly.',
        },
        {
            stageId: stage4_2.id,
            text: 'Switch to subcutaneous insulin now to simplify management',
            isCorrect: false,
            scoreWeight: -3,
            feedback: 'Too early! Transition to subcutaneous only when: eating/drinking, pH >7.3, ketones <0.6. Give long-acting SC insulin 1 hour before stopping FRIII to avoid rebound DKA.',
        },
    ]);

    // ============================================================================
    // CASE 5: Acute Asthma Exacerbation (Respiratory, Foundation)
    // ============================================================================
    console.log('🏥 Seeding Case 5: Acute Asthma...');

    const [case5] = await db.insert(cases).values({
        userId: 'user_38zNKdM9PQvaMhsqkljCfE7R4W7', // Assign to specific student user
        title: 'Shortness of Breath in Known Asthmatic',
        description: 'A 25-year-old woman with asthma presents to A&E with worsening breathlessness and wheeze over 24 hours, not responding to her salbutamol inhaler.',
        clinicalDomain: 'Respiratory',
        difficultyLevel: 'Foundation',
        isPublished: true,
    }).returning();

    const [stage5_1] = await db.insert(caseStages).values({
        caseId: case5.id,
        stageOrder: 1,
        narrative: 'A 25-year-old woman with known asthma presents with increasing breathlessness and wheeze for the past 24 hours. She has used her salbutamol inhaler "more than 10 times today" with minimal relief. She has been unable to complete sentences due to breathlessness. Background: Usually controlled on Clenil (beclometasone) 200mcg BD. Recent URTI one week ago.',
        clinicalData: {
            RR: 26,
            HR: 112,
            SpO2: 94,
            peak_flow: '40% of predicted',
            notes: ['Unable to complete sentences', 'Widespread polyphonic wheeze', 'Using accessory muscles'],
        },
    }).returning();

    await db.insert(stageOptions).values([
        {
            stageId: stage5_1.id,
            text: 'Classify as acute severe asthma - give oxygen, nebulised salbutamol 5mg + ipratropium 500mcg, prednisolone 40mg PO',
            isCorrect: true,
            scoreWeight: 2,
            feedback: 'Correct! Acute severe asthma features: PEFR 33-50%, RR ≥25, HR ≥110, inability to complete sentences. BTS SIGN: Oxygen (target 94-98%), back-to-back nebulisers, oral steroids (prednisolone 40-50mg).',
        },
        {
            stageId: stage5_1.id,
            text: 'This is mild asthma - discharge with increased inhaler use and GP follow-up',
            isCorrect: false,
            scoreWeight: -5,
            feedback: 'Dangerously wrong! This is acute severe asthma (PEFR <50%, tachypnoeic, tachycardic, cannot complete sentences). Discharging risks fatal asthma attack. Admit for monitoring and escalation.',
        },
        {
            stageId: stage5_1.id,
            text: 'Give IV hydrocortisone 100mg and call ICU for intubation',
            isCorrect: false,
            scoreWeight: -2,
            feedback: 'Premature escalation. This is acute severe, not life-threatening asthma (no cyanosis, silent chest, exhaustion, or PEFR <33%). Start standard treatment first. Intubation is rare and last resort.',
        },
        {
            stageId: stage5_1.id,
            text: 'Request arterial blood gas (ABG) before starting treatment',
            isCorrect: false,
            scoreWeight: -1,
            feedback: 'Unnecessary delay! ABG is indicated for life-threatening asthma (SpO2 <92%, silent chest, confusion) or if patient not improving. Start treatment immediately - do not wait for investigations.',
        },
    ]);

    const [stage5_2] = await db.insert(caseStages).values({
        caseId: case5.id,
        stageOrder: 2,
        narrative: 'After 1 hour of nebulised bronchodilators and oral prednisolone, the patient reports some improvement. However, her peak flow is still only 50% of predicted, RR 22, and SpO2 96% on room air.',
        clinicalData: {
            RR: 22,
            HR: 98,
            SpO2: 96,
            peak_flow: '50% of predicted',
            notes: ['Persistent wheeze but less distressed', 'Able to speak in full sentences now'],
        },
    }).returning();

    await db.insert(stageOptions).values([
        {
            stageId: stage5_2.id,
            text: 'Continue nebulisers (salbutamol ± ipratropium) every 4-6 hours and monitor on acute medical unit',
            isCorrect: true,
            scoreWeight: 2,
            feedback: 'Appropriate! Improving but still acute severe asthma (PEFR <60%). Admit for monitoring, continue bronchodilators, ensure 5-day steroid course, and monitor PEFR. Discharge when PEFR >75% and stable >24hrs.',
        },
        {
            stageId: stage5_2.id,
            text: 'Patient is improved - discharge with steroid course and asthma action plan',
            isCorrect: false,
            scoreWeight: -3,
            feedback: 'Unsafe! PEFR is still 50% (should be >75% for discharge). BTS SIGN: Do not discharge if PEFR <75% best/predicted or if symptoms/signs persist. Premature discharge risks rebound exacerbation.',
        },
        {
            stageId: stage5_2.id,
            text: 'Give IV magnesium sulphate 2g over 20 minutes',
            isCorrect: false,
            scoreWeight: 1,
            feedback: 'Not indicated yet. IV MgSO4 is for acute severe asthma not responding to initial treatment or life-threatening features. This patient is improving. Continue standard therapy and reassess.',
        },
        {
            stageId: stage5_2.id,
            text: 'Start IV aminophylline infusion',
            isCorrect: false,
            scoreWeight: -2,
            feedback: 'Not first-line! Aminophylline is reserved for life-threatening asthma or ICU-level care (after senior/ICU review). It has narrow therapeutic window and risk of arrhythmias. Not indicated here.',
        },
    ]);

    console.log('✅ All seed data inserted successfully!');
    console.log('\n📊 Summary:');
    console.log('- 2 Users (1 student, 1 admin)');
    console.log('- 5 UKMLA-style Medical Cases');
    console.log('  1. Acute Chest Pain - STEMI (Cardiology, Advanced)');
    console.log('  2. Sepsis Management (Critical Care, Advanced)');
    console.log('  3. Anaphylaxis (Emergency Medicine, Core)');
    console.log('  4. Diabetic Ketoacidosis (Endocrinology, Core)');
    console.log('  5. Acute Asthma (Respiratory, Foundation)');
    console.log('- 11 Total Case Stages');
    console.log('- 45 Decision Options with Nuanced Scoring');
}

main()
    .then(() => {
        console.log('\n🎉 Database seeded successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    });
