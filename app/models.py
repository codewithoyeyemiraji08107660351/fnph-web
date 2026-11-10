from datetime import datetime, timezone
from flask_login import UserMixin
from werkzeug.security import generate_password_hash,check_password_hash
from sqlalchemy import CheckConstraint, UniqueConstraint
from .extensions import db

class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), default=datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime(timezone=True), default=datetime.now(timezone.utc), onupdate =datetime.now(timezone.utc), nullable=False)


class User(UserMixin, TimestampMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(200), nullable=False, unique=True)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(50), nullable=False, default="staff")
    is_active_account = db.Column(db.Boolean, nullable=False, default = True)
    __table_args__ = (CheckConstraint("role in('admin', 'manager', 'staff')", name="ck_users_role"),)


    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)   

    @property
    def is_active(self):
        return self.is_active_account

class Category(TimestampMixin, db.Model):
     __tablename__ = "category"
     id = db.Column(db.Integer, primary_key=True)
     name = db.Column(db.String(200), nullable=False, unique=True)
     description = db.Column(db.String(500), nullable=True)
     products = db.relationship("Product", back_populates="category")


#Suppliers
class Suppliers(TimestampMixin, db.Model):
    pass
#Products
#StockMovement