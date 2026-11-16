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
    movements = db.relationship("StockMovement", back_populates="user", lazy="dynamic")
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
    __tablename__ = "suppliers"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(200), nullable=True)
    phone_number = db.Column(db.String(20), nullable=True)
    address = db.Column(db.String(500), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    products = db.relationship("Product", back_populates="supplier")

#Products
class Product(TimestampMixin, db.Model):
    __tablename__ = "products"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.String(500), nullable=True)
    price = db.Column(db.Float, nullable=False)
    reorder_level = db.Column(db.Integer, nullable=False, default=0)
    quantity_in_stock = db.Column(db.Integer, nullable=False, default=0)
    category_id = db.Column(db.Integer, db.ForeignKey("category.id", ondelete="CASCADE"), nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey("suppliers.id"), nullable=False)
    category = db.relationship("Category", back_populates="products")
    supplier = db.relationship("Suppliers", back_populates="products")
    movements = db.relationship("StockMovement", back_populates="product", lazy="dynamic")

    @property
    def is_below_reorder_level(self):
        return self.quantity_in_stock <= 2



#StockMovement
class StockMovement(TimestampMixin, db.Model):
    __tablename__ = "stock_movements"
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey("products.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    before_quantity = db.Column(db.Integer, nullable=False)
    after_quantity = db.Column(db.Integer, nullable=False)
    movement_type = db.Column(db.String(50), nullable=False)  
    product = db.relationship("Product", back_populates="movements")
    user = db.relationship("User", back_populates="movements")
