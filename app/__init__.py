import os
from flask import Flask, jsonify, render_template
from .extensions import db, migrate, login_manager, csrf, limiter
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
    csrf.init_app(app)
    limiter.init_app(app)


    from .controllers.auth import auth_bp
    from .controllers.main import main_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)


    @login_manager.user_loader
    def load_user(user_id):
        try:
            return db.session.get(User, int(user_id))
        except (TypeError, ValueError):
            return None
        
    @app.errorhandler(404)
    def not_found_error(error):
        return render_template("error/404.html"), 404
       





































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