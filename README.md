# 🎓 AI PlacePro - End-to-End Placement Training System

An AI-powered placement training platform that personalizes learning paths, analyzes skills, and prepares students for successful job placements.

## 📋 Table of Contents
- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [System Modules](#system-modules)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Folder Structure](#folder-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Resume Analyzer API Integration](#resume-analyzer-api-integration)
- [Future Enhancements](#future-enhancements)

## 🎯 Overview

AI PlacePro is a comprehensive placement training system that uses Artificial Intelligence and Machine Learning to provide personalized training to students. The system analyzes individual strengths and weaknesses, creates custom learning roadmaps, and provides AI-powered feedback to improve placement success rates.

## ❌ Problem Statement

Many students fail to crack placements due to:
- **Lack of personalized guidance** - Generic training for everyone
- **No clear roadmap** - Students don't know what to study
- **One-size-fits-all approach** - Same content regardless of skill level
- **No proper feedback** - Mock interviews lack actionable insights

Current platforms are not adaptive to individual student weaknesses.

## ✅ Solution

AI PlacePro uses AI + ML to:
1. **Analyze student skills** - Resume, academic data, interests
2. **Create personalized roadmap** - Custom learning path for each student
3. **Train students** - From basic to placement-ready
4. **Give AI-based feedback** - Real-time improvement suggestions

**Simple Flow:** Student enters → AI trains → Student gets placement ready

## 🔧 System Modules

### 1️⃣ Student Profile Analyzer
- Upload and analyze resume
- Skills assessment
- Academic data collection
- Interest mapping
- AI-powered strength/weakness detection

### 2️⃣ Skill Gap Detection (ML Model)
- Compare student skills with company requirements
- Job role standards matching
- Detect missing skills
- Priority-based skill recommendations

### 3️⃣ Personalized Learning Path (AI)
- Daily study schedule generation
- Adaptive coding practice levels
- Aptitude and verbal training
- Progress-based path adjustments

### 4️⃣ Coding Practice Platform
- 500+ problems categorized by difficulty
- Company-specific question banks
- Real-time code execution
- AI hints and explanations

### 5️⃣ Resume Analyzer (NLP)
- **ATS compatibility score**
- **Keyword optimization**
- **Grammar and structure check**
- **Automatic improvement suggestions**

### 6️⃣ Placement Prediction Module
- ML-based placement probability
- Best-fit job role suggestions
- Target company recommendations
- Salary range estimation

## ✨ Features

### Landing Page
- ✅ Modern, animated hero section
- ✅ Problem-solution presentation
- ✅ System modules showcase
- ✅ Technology stack display
- ✅ Responsive design

### Authentication
- ✅ Sign In / Sign Up pages
- ✅ LocalStorage-based authentication
- ✅ Form validation
- ✅ Demo user login
- ✅ Remember me functionality

### Dashboard
- ✅ Personalized welcome
- ✅ Progress tracking with stats
- ✅ **Strengths analysis** (with scores)
- ✅ **Weaknesses identification** (with improvement suggestions)
- ✅ Daily task planner
- ✅ AI recommendations
- ✅ Multi-section navigation

### Resume Analyzer
- ✅ **Drag & drop file upload**
- ✅ **PDF, DOC, DOCX support**
- ✅ **ATS score calculation**
- ✅ **Keyword analysis** (found vs missing)
- ✅ **Content quality scoring**
- ✅ **Detailed improvement suggestions**
- ✅ **Before/after examples**
- ✅ **Downloadable report**

## 🛠️ Technology Stack

### Frontend
- HTML5
- CSS3 (Custom CSS with CSS Variables)
- JavaScript (Vanilla JS)

### Backend (For Future API Integration)
- Node.js / Flask / Django
- Python for ML models

### AI / ML
- Python
- Scikit-Learn (for skill gap detection)
- NLP (SpaCy / NLTK) for resume analysis
- TensorFlow (for placement prediction)

### Database (For Production)
- MySQL / MongoDB / PostgreSQL

### Storage
- LocalStorage (current implementation)
- Future: Backend database with API

## 📁 Folder Structure

```
ai-placement-system/
│
├── index.html                 # Landing page
│
├── pages/
│   ├── login.html            # Login page
│   ├── signup.html           # Signup page
│   ├── dashboard.html        # Main dashboard
│   └── resume.html           # Resume analyzer
│
├── css/
│   ├── main.css              # Global styles and variables
│   ├── landing.css           # Landing page styles
│   ├── auth.css              # Authentication pages styles
│   ├── dashboard.css         # Dashboard styles
│   └── resume.css            # Resume analyzer styles
│
├── js/
│   ├── main.js               # Global JavaScript utilities
│   ├── auth.js               # Authentication logic
│   ├── dashboard.js          # Dashboard functionality
│   └── resume-analyzer.js    # Resume analysis logic
│
├── assets/
│   ├── images/               # Image files
│   └── icons/                # Icon files
│
├── data/
│   └── (localStorage used for now)
│
└── README.md                 # Project documentation
```

## 🚀 Installation

1. **Clone or download the project**
```bash
cd ai-placement-system
```

2. **Open in browser**
- Simply open `index.html` in your web browser
- Or use a local server (recommended):

```bash
# Using Python
python -m http.server 8000

# Using Node.js (http-server)
npx http-server

# Using VS Code Live Server extension
Right-click on index.html → Open with Live Server
```

3. **Access the application**
```
http://localhost:8000
```

## 📖 Usage

### Getting Started

1. **Visit Landing Page**
   - Browse features and modules
   - Click "Get Started" or "Sign Up"

2. **Create Account**
   - Fill in your details
   - Submit to create account
   - Auto-redirect to dashboard

3. **Or Use Demo Login**
   - Click "Continue as Demo User" on login page
   - Instant access to pre-populated dashboard

### Using the Dashboard

1. **View Progress**
   - Overall progress percentage
   - Skills improved count
   - Problems solved
   - Placement score

2. **Analyze Strengths & Weaknesses**
   - See your top skills
   - Identify areas needing improvement
   - Get personalized recommendations

3. **Upload Resume**
   - Click "Upload Resume" button
   - Drag & drop or browse file
   - Get instant AI analysis

### Resume Analyzer

1. **Upload Your Resume**
   - Supported formats: PDF, DOC, DOCX
   - Max size: 5MB
   - Drag & drop or click to upload

2. **Get Analysis**
   - Overall ATS score (0-100)
   - Breakdown by category:
     - ATS Compatibility
     - Keywords & Skills
     - Content Quality
     - Formatting

3. **Review Results**
   - **Strengths Tab**: What's working well
   - **Improvements Tab**: Priority fixes
   - **Keywords Tab**: Found vs missing keywords
   - **Suggestions Tab**: AI-generated improvements

4. **Take Action**
   - Download detailed PDF report
   - Auto-optimize resume
   - Apply suggestions manually

## 🔌 Resume Analyzer API Integration

### Current Implementation
The resume analyzer currently uses **simulated AI scoring** with hardcoded analysis results for demonstration purposes.

### API Integration Guide

To integrate with a real resume parsing API, you can use:



### Scoring Algorithm Example

```javascript
function calculateScores(resumeData) {
    const scores = {
        overall: 0,
        ats: 0,
        keywords: 0,
        content: 0,
        format: 0
    };
    
    // ATS Score (30%)
    scores.ats = calculateATSCompatibility(resumeData);
    
    // Keywords Score (30%)
    scores.keywords = calculateKeywordMatch(resumeData);
    
    // Content Score (25%)
    scores.content = calculateContentQuality(resumeData);
    
    // Format Score (15%)
    scores.format = calculateFormatScore(resumeData);
    
    // Overall weighted score
    scores.overall = Math.round(
        scores.ats * 0.30 +
        scores.keywords * 0.30 +
        scores.content * 0.25 +
        scores.format * 0.15
    );
    
    return scores;
}
```

## 🎨 Customization

### Changing Colors
Edit `/css/main.css`:
```css
:root {
    --primary: #6366f1;     /* Change primary color */
    --secondary: #8b5cf6;   /* Change secondary color */
    /* ... more variables */
}
```

## 🔮 Future Enhancements

### Phase 1 (Current)
- ✅ Frontend with LocalStorage
- ✅ Basic resume analysis simulation
- ✅ Dashboard with analytics

### Phase 2 (Next)
- [ ] Backend API development
- [ ] Real AI/ML model integration
- [ ] Database implementation
- [ ] User authentication with JWT
- [ ] Resume parser API integration

### Phase 3 (Advanced)
- [ ] Real-time mock interviews with AI
- [ ] Video interview analysis
- [ ] Company-specific preparation modules
- [ ] Peer comparison and leaderboards
- [ ] Interview scheduling with companies
- [ ] Job recommendations based on profile

### Phase 4 (Enterprise)
- [ ] College/University dashboard
- [ ] Recruiter panel
- [ ] Analytics and reporting
- [ ] Mobile app (React Native)
- [ ] Multilingual support

## 📊 Data Storage

### Current: LocalStorage
```javascript
// User data structure
{
    id: timestamp,
    fullName: "John Doe",
    email: "john@example.com",
    phone: "+91 9876543210",
    college: "University Name",
    resumeData: {
        fileName: "resume.pdf",
        scores: { ... },
        uploadDate: "2024-01-20"
    },
    skillsAnalyzed: true,
    profileComplete: true
}
```

### Future: Database Schema

**Users Table:**
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20),
    college VARCHAR(255),
    password_hash VARCHAR(255),
    created_at TIMESTAMP,
    profile_complete BOOLEAN
);
```

**Resumes Table:**
```sql
CREATE TABLE resumes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    file_name VARCHAR(255),
    file_path VARCHAR(500),
    ats_score INT,
    keywords_score INT,
    content_score INT,
    format_score INT,
    overall_score INT,
    analyzed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

