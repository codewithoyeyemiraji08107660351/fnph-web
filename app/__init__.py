
import os
from pathlib import Path
from flask import Flask, render_template
from dotenv import load_dotenv

from .extensions import db, migrate, login_manager, csrf, limiter
from .models import User

#flask --app run.py db init
#flask --app run.py db migrate -m "Create users table"
#flask --app run.py db upgrade


def create_app(test_config=None):

    project_root = Path(__file__).resolve().parent.parent
    load_dotenv(project_root / ".env")

    app = Flask(__name__, instance_relative_config=True)

    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY", "dev"),

        SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL"),

        SQLALCHEMY_TRACK_MODIFICATIONS=False,

        SQLALCHEMY_ENGINE_OPTIONS={
            "pool_pre_ping": True,
            "pool_recycle": 280
        },

        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SECURE=False,
        SESSION_COOKIE_SAMESITE="Lax",

        CSRF_COOKIE_SECURE =False,
        WTF_CSRF_SSL_STRICT =False,
    )


    if test_config:
        app.config.update(test_config)

    os.makedirs(app.instance_path, exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    csrf.init_app(app)
    limiter.init_app(app)


    login_manager.login_view = "auth.login"
    login_manager.login_message = "Please log in to access this page."

    
    from .controllers.auth import auth_bp
    #from .controllers.main import main_bp

    app.register_blueprint(auth_bp)
    #app.register_blueprint(main_bp)

    @login_manager.user_loader
    def load_user(user_id):

        try:
            return db.session.get(User, int(user_id))

        except (TypeError, ValueError):
            return None

    # Error handlers
    @app.errorhandler(404)
    def not_found_error(error):
        return render_template("error/404.html"), 404

    return app
