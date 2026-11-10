#Server -> WGSI(Web Server Gateway Interface) -> 
# Flask App -> Blueprint -> Controller -> Model -> Databaser
#gunicorn, waitress, uwsgi, hypercorn, daphne, mod_wsgi
from flask import Flask, render_template, flash, redirect, url_for, request
from flask_login import current_user, login_user, logout_user
from flask_limiter import db, limiter, migrate
from ..extensions import db, limiter
from ..models import User
#localhost:5000/api/v1/auth/login Modal

@auth_bp.route("/api/v1/auth/login", methods=["GET", "POST"])
@limiter.limit("5 per minute")
def login():
    if current_user.is_authenticated:
        return redirect(url_for("main.dashboard"))
    if request.method == "POST":
        email = request.form.get("email")
        password = request.form.get("password")
        user = db.session.scalar(db.select(User).where(User.email == email))
        if user and user.check_password(password):
            login_user(user)
            flash("Logged in successfully.", "success")
            return redirect(url_for("main.dashboard"))
        else:
            flash("Invalid email or password.", "danger")
    return render_template("auth/login.html")

@auth_bp.post("/api/v1/auth/logout")
def logout():
    logout_user()
    flash("You have been logged out.", "info")
    return redirect(url_for("auth.login"))