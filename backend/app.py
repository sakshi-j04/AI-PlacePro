"""AI PlacePro - Flask Backend Application"""
import os
from pathlib import Path
from flask import Flask, abort, send_from_directory
from flask_cors import CORS

from config import UPLOAD_FOLDER, MAX_CONTENT_LENGTH, DATABASE_URI, SECRET_KEY
from models import db
from routes.auth import auth_bp
from routes.resume import resume_bp
from routes.training import training_bp
from routes.prediction import prediction_bp
from routes.companies import companies_bp

# Project root (parent of backend/) – frontend files live here
FRONTEND_ROOT = Path(__file__).resolve().parent.parent


def create_app():
    app = Flask(__name__)
    app.config["SECRET_KEY"] = SECRET_KEY
    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URI
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["UPLOAD_FOLDER"] = str(UPLOAD_FOLDER)
    app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

    db.init_app(app)

    with app.app_context():
        uri = app.config["SQLALCHEMY_DATABASE_URI"]
        if uri.startswith("sqlite"):
            Path(uri.replace("sqlite:///", "")).parent.mkdir(parents=True, exist_ok=True)
        db.create_all()

    CORS(app, resources={r"/api/*": {"origins": "*"}})

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(resume_bp, url_prefix="/api/resume")
    app.register_blueprint(training_bp, url_prefix="/api/training")
    app.register_blueprint(prediction_bp, url_prefix="/api/prediction")
    app.register_blueprint(companies_bp, url_prefix="/api/companies")

    @app.route("/api/health")
    def health():
        return {"status": "ok", "message": "AI PlacePro API is running"}

    @app.route("/")
    def index():
        """Serve frontend home page."""
        return send_from_directory(FRONTEND_ROOT, "index.html")

    @app.route("/<path:path>")
    def serve_frontend(path):
        """Serve frontend static files; fallback to index for SPA (single localhost, no folder exposure)."""
        if path.startswith("api/"):
            abort(404)
        file_path = FRONTEND_ROOT / path
        if file_path.is_file():
            return send_from_directory(FRONTEND_ROOT, path)
        if path.startswith("pages/"):
            html_path = path if path.endswith(".html") else f"{path}.html"
            if (FRONTEND_ROOT / html_path).is_file():
                return send_from_directory(FRONTEND_ROOT, html_path)
        # SPA fallback: any other path serves index so one link (localhost:5000) works
        return send_from_directory(FRONTEND_ROOT, "index.html")

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
