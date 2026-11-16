
from flask import Blueprint, request, jsonify
from flask_login import current_user, login_user, logout_user
from flask_limiter import Limiter

from sqlalchemy.exc import IntegrityError

from ..extensions import db, limiter
from ..models import User
from ..extensions import csrf

auth_bp = Blueprint("auth", __name__)
csrf.exempt(auth_bp)

@auth_bp.post("/api/v1/auth/register")
@limiter.limit("5 per minute")
def register():

    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "success": False,
            "message": "Request body must be valid JSON."
        }), 400

    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")

    
    if not all([name, email, password, confirm_password]):
        return jsonify({
            "success": False,
            "message": "All fields are required."
        }), 400

    if len(name) > 50:
        return jsonify({
            "success": False,
            "message": "Name cannot exceed 50 characters."
        }), 400

    if len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 8 characters."
        }), 400

    if password != confirm_password:
        return jsonify({
            "success": False,
            "message": "Passwords do not match."
        }), 400

    existing_user = db.session.scalar(
        db.select(User).where(User.email == email)
    )

    if existing_user:
        return jsonify({
            "success": False,
            "message": "Email already registered."
        }), 409

    new_user = User(
        name=name,
        email=email,
        role="staff"
    )

    new_user.set_password(password)

    try:
        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            "success": True,
            "message": "Registration successful.",
            "data": {
                "id": new_user.id,
                "name": new_user.name,
                "email": new_user.email,
                "role": new_user.role
            }
        }), 201

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "Email already registered."
        }), 409

    except Exception:
        db.session.rollback()

        return jsonify({
            "success": False,
            "message": "An error occurred during registration."
        }), 500


@auth_bp.post("/api/v1/auth/login")
@limiter.limit("5 per minute")
def login():

    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "success": False,
            "message": "Request body must be valid JSON."
        }), 400

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Email and password are required."
        }), 400

    user = db.session.scalar(
        db.select(User).where(User.email == email)
    )

    if not user or not user.is_active or not user.check_password(password):
        return jsonify({
            "success": False,
            "message": "Invalid email or password."
        }), 401

    login_user(user)

    return jsonify({
        "success": True,
        "message": "Login successful.",
        "data": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }), 200


@auth_bp.post("/api/v1/auth/logout")
def logout():

    if not current_user.is_authenticated:
        return jsonify({
            "success": False,
            "message": "You are not logged in."
        }), 401

    logout_user()

    return jsonify({
        "success": True,
        "message": "Logout successful."
    }), 200
