import os
from flask import Flask, jsonify, render_template
from .extensions import db, migrate, login_manager, crsf, limiter
from .models import User

def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev"),
        SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SESSION_COOKIE_HTTPONLY= True,
    )

    if test_config:
        app.config.update(test_config)

    os.makedirs(app.instance_path,exist_ok=True)
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    crsf.init_app(app)
    limiter.init_app(app)





































# depenpdencies and virtual environment
# python -m venv .venv .\.venv\Scripts\Activate.ps1
# pip install 
# pip install PyMySQL
# pip install Flask-Login
# pip install Flask-WTF 
# pip install Flask-Limiter
# pip install python-dotenv 
# pip install email-validator
# pip install pytest-cov