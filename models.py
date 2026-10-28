
from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class AdminUser(db.Model):
    __tablename__ = "admin_users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class SiteSetting(db.Model):
    __tablename__ = "site_settings"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(120), unique=True, nullable=False)
    value = db.Column(db.Text)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow,
        onupdate=datetime.utcnow, nullable=False
    )


class Location(db.Model):
    __tablename__ = "locations"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    slug = db.Column(db.String(150), unique=True, nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(500))
    is_active = db.Column(db.Boolean, default=True, nullable=False)


class MenuCategory(db.Model):
    __tablename__ = "menu_categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    slug = db.Column(db.String(150), unique=True, nullable=False)
    description = db.Column(db.Text)
    sort_order = db.Column(db.Integer, default=0, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)


class MenuItem(db.Model):
    __tablename__ = "menu_items"

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(
        db.Integer, db.ForeignKey("menu_categories.id"),
        nullable=True
    )
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    ingredients = db.Column(db.Text)
    price = db.Column(db.Numeric(12, 2))
    image_url = db.Column(db.String(500))
    is_available = db.Column(db.Boolean, default=True, nullable=False)
    sort_order = db.Column(db.Integer, default=0, nullable=False)

    category = db.relationship("MenuCategory")


class Reservation(db.Model):
    __tablename__ = "reservations"

    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(255))
    phone = db.Column(db.String(40), nullable=False)
    location_id = db.Column(db.Integer, db.ForeignKey("locations.id"))
    reservation_type = db.Column(
        db.String(20), nullable=False, default="table", server_default="table"
    )
    space_name = db.Column(db.String(150))
    event_type = db.Column(db.String(150))
    reservation_at = db.Column(db.DateTime, nullable=False)
    party_size = db.Column(db.Integer, nullable=False)
    notes = db.Column(db.Text)
    status = db.Column(db.String(30), default="pending", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    location = db.relationship("Location")


class ContactMessage(db.Model):
    __tablename__ = "contact_messages"

    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(255))
    phone = db.Column(db.String(40))
    subject = db.Column(db.String(200))
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(30), default="new", nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class FeedbackSubmission(db.Model):
    __tablename__ = "feedback_submissions"

    id = db.Column(db.Integer, primary_key=True)
    customer_name = db.Column(db.String(150))
    contact = db.Column(db.String(255))
    email = db.Column(db.String(255))
    phone = db.Column(db.String(40))
    space_name = db.Column(db.String(150))
    type = db.Column(db.String(30), default="other", nullable=False)
    subject = db.Column(db.String(200))
    message = db.Column(db.Text)
    answers = db.Column(db.JSON)
    comments = db.Column(db.Text)
    status = db.Column(db.String(30), default="new", nullable=False)
    internal_notes = db.Column(db.Text)
    submission_token = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class CTAEvent(db.Model):
    __tablename__ = "cta_events"

    id = db.Column(db.Integer, primary_key=True)
    button_key = db.Column(db.String(120), nullable=False)
    page_path = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)