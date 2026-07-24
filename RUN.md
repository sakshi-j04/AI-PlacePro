# How to Run AI PlacePro

## One-time setup (first time only)

1. **Backend (Python)**  
   Open terminal in project folder:
   ```powershell
   cd backend
   python -m venv ..\.venv
   ..\.venv\Scripts\activate
   pip install -r requirements.txt
   ```
   Or use a venv inside `backend`: `python -m venv .venv`, then `.\.venv\Scripts\activate`, then `pip install -r requirements.txt`.

   **If you get "No Python at..."** the venv was created on another PC. Recreate it: from project root run `python -m venv .venv`, then `.\.venv\Scripts\activate`, `cd backend`, `pip install -r requirements.txt`.

2. **Frontend**  
   No install needed. We use Python's built-in server.

---

## Every time you want to run the app

### Terminal 1 – Backend (keep open)
```powershell
cd <path-to-project>\backend
# If using project-root venv:
..\.venv\Scripts\activate
# Or if using backend\.venv:  .\.venv\Scripts\activate
python run.py
```
Wait until you see: `Running on http://127.0.0.1:5000` (or `http://0.0.0.0:5000`).

### Terminal 2 – Frontend (keep open)
```powershell
cd <path-to-project>
python -m http.server 5500
```
Wait until you see: `Serving HTTP on ... port 5500`

### Browser
Open: **http://127.0.0.1:5500**

- **Student:** Sign up / Login → Dashboard → Upload Resume (Resume Analyzer)
- **Company:** Company Login → Add Job Role (so students see jobs and match scores)

---

## URLs

| Page            | URL |
|-----------------|-----|
| Home            | http://127.0.0.1:5500 |
| Student Login   | http://127.0.0.1:5500/pages/login.html |
| Student Signup  | http://127.0.0.1:5500/pages/signup.html |
| Student Dashboard | http://127.0.0.1:5500/pages/dashboard.html |
| Resume Analyzer | http://127.0.0.1:5500/pages/resume.html |
| Company Login   | http://127.0.0.1:5500/pages/company-login.html |
| Company Dashboard | http://127.0.0.1:5500/pages/company-dashboard.html |

Backend API: http://127.0.0.1:5000 (health: http://127.0.0.1:5000/api/health)
