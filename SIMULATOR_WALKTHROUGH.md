# Interactive Clinical Simulator Walkthrough

## How to Test

1. **Access the Simulator**
   - Go to `http://localhost:3000/cases`
   - Click on any case (e.g., "Acute Chest Pain - STEMI")
   - Click the green **"▶ Start Simulation"** button

2. **Playing a Case**
   - **Read the Patient Presentation**: Review the narrative and vital signs.
   - **Make a Decision**: Select one of the options (A, B, C, D).
   - **Review Feedback**:
     - See immediate feedback on your choice.
     - Note the score change (Green for positive, Red for negative).
   - **Advance**: Click "Continue to Next Stage".

3. **Verify Scoring**
   - Scores accumulate across stages.
   - Initial Score: 0
   - Correct choices add points (usually +2).
   - Dangerous choices subtract points (-5).

4. **Completion**
   - Reach the final stage to see your total score.
   - Click "Play Again" to restart.

## Key Features to Observe
- **Weighted Scoring**: Not just Right/Wrong, but "Good", "Bad", "Neutral".
- **Real-Time Feedback**: Explains *why* a choice was correct/incorrect.
- **Clinical Data**: Vitals (BP, HR, etc.) displayed in a realistic card format.
- **Progress Tracking**: Shows current stage and completion percentage.

## Troubleshooting
- If you see "Incomplete Case", the case has no stages added yet.
- If you get a 404, ensure the case ID exists and you are logged in.
