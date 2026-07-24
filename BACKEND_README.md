# AI PlacePro Backend

Flask backend for resume analysis, skill gap detection, placement prediction, and LLM-based training plans.

## Setup

```bash
cd backend
pip install -r requirements.txt
```

## Configuration

Copy `.env.example` to `.env` and optionally set:
- `OPENAI_API_KEY` - For LLM-powered training plans (optional; uses rule-based plans otherwise)

## Run

```bash
python run.py
# or
python -m flask run --host=0.0.0.0 --port=5000
```

API runs at `http://localhost:5000`

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/resume/analyze` | POST | Analyze resume (PDF/DOC/DOCX) - NLP, skills, placement prediction |
| `/api/training/plan` | POST | Generate personalized training plan |
| `/api/prediction/generate` | POST | Generate placement prediction from analysis data |
| `/api/auth/register` | POST | Register user |
| `/api/auth/login` | POST | Login |

## Resume Analysis

Upload a resume file to `/api/resume/analyze` (form field: `resume` or `file`).

Returns: scores, foundSkills, missingSkills, placementPrediction, strengths, improvements.

## Training Plan

POST JSON to `/api/training/plan`:
```json
{
  "resumeData": { ... },
  "useLLM": true
}
```

Returns: dailyTasks, weeklyPlan, recommendations, estimatedReadiness.

## Placement Model

The backend uses `placement_prediction_model.pkl` from the project root when available. The model is trained on the same 8 features used at runtime (overall, ATS, keyword, content, format scores; skills count; missing skills count; skill ratio). To (re)train the model:

```bash
cd backend
python train_placement_model.py
```

This writes `placement_prediction_model.pkl` in the project root. If the file is missing or invalid, a rule-based fallback is used.
