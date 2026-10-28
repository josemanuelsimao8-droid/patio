import hmac
import json
import os
import re
import secrets
import unicodedata
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

import click
from dotenv import load_dotenv
from flask import (
    Flask,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from sqlalchemy import inspect, or_, select, text
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from models import (
    AdminUser,
    FeedbackSubmission,
    MenuCategory,
    MenuItem,
    Reservation,
    SiteSetting,
    db,
)


ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
RESERVATION_SPACES = {
    "Pátio Morro Bento",
    "Pátio Mutamba",
    "Roots by Pátio Luanda",
    "Pátio Aeroporto",
    "A definir com a equipa",
}
FEEDBACK_SPACES = {
    "Pátio Morro Bento",
    "Pátio Mutamba",
    "Roots by Pátio Luanda",
    "Pátio Aeroporto",
    "Pastelaria Pátio",
    "Catering",
    "Evento ou salão",
    "Outro serviço do Grupo Pátio",
}


def create_app(test_config=None):
    app = Flask(__name__, template_folder="templates", static_folder="static")
    secret_key = os.getenv("SECRET_KEY", "")
    if not secret_key or secret_key == "trocar-por-uma-chave-secreta":
        secret_key = secrets.token_urlsafe(48)

    database_url = os.getenv("DATABASE_URL", "sqlite:///patio.sqlite3")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    app.config.update(
        SECRET_KEY=secret_key,
        SQLALCHEMY_DATABASE_URI=database_url,
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.getenv("COOKIE_SECURE", "0") == "1",
        PERMANENT_SESSION_LIFETIME=timedelta(hours=8),
        MAX_CONTENT_LENGTH=8 * 1024 * 1024,
        UPLOAD_FOLDER=ROOT / "assets" / "uploads",
    )
    if test_config:
        app.config.update(test_config)

    db.init_app(app)

    def csrf_token():
        token = session.get("csrf_token")
        if not token:
            token = secrets.token_urlsafe(32)
            session["csrf_token"] = token
        return token

    def signed_in():
        user_id = session.get("admin_user_id")
        return db.session.get(AdminUser, user_id) if user_id else None

    def require_admin():
        user = signed_in()
        if not user or not user.is_active:
            abort(401)
        return user

    def require_csrf():
        expected = session.get("csrf_token", "")
        supplied = request.headers.get("X-CSRFToken", "")
        if not expected or not hmac.compare_digest(expected, supplied):
            abort(400, description="Token de segurança inválido. Atualize a página e tente novamente.")

    def safe_slug(value):
        normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
        return re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")

    def migrate_feature_schema():
        db.create_all()
        additions = {
            "menu_items": {"ingredients": "TEXT"},
            "feedback_submissions": {
                "email": "VARCHAR(255)",
                "phone": "VARCHAR(40)",
                "type": "VARCHAR(30) NOT NULL DEFAULT 'other'",
                "subject": "VARCHAR(200)",
                "message": "TEXT",
                "status": "VARCHAR(30) NOT NULL DEFAULT 'new'",
                "internal_notes": "TEXT",
                "submission_token": "VARCHAR(64)",
            },
        }
        inspector = inspect(db.engine)
        with db.engine.begin() as connection:
            for table, columns in additions.items():
                if not inspector.has_table(table):
                    continue
                existing = {column["name"] for column in inspector.get_columns(table)}
                for column, definition in columns.items():
                    if column not in existing:
                        connection.execute(text(
                            f'ALTER TABLE "{table}" ADD COLUMN "{column}" {definition}'
                        ))
            if inspector.has_table("feedback_submissions"):
                connection.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS "
                    "uq_feedback_submissions_submission_token "
                    "ON feedback_submissions (submission_token)"
                ))

    def import_menu_json():
        source = ROOT / "data" / "menu.json"
        with source.open(encoding="utf-8") as menu_file:
            menu_data = json.load(menu_file)
        added = 0
        for category_data in menu_data.get("categories", []):
            slug = safe_slug(str(category_data.get("id", "")))
            name = str(category_data.get("category", "")).strip()
            if not slug or not name:
                continue
            category = db.session.scalar(
                select(MenuCategory).where(MenuCategory.slug == slug)
            )
            if category is None:
                category = MenuCategory(name=name[:150], slug=slug, is_active=True)
                db.session.add(category)
                db.session.flush()
            existing_names = {
                item.name.strip().casefold()
                for item in MenuItem.query.filter_by(category_id=category.id).all()
            }
            for item_data in category_data.get("items", []):
                item_name = str(item_data.get("name", "")).strip()
                if not item_name or item_name.casefold() in existing_names:
                    continue
                price_text = re.sub(r"[^0-9,.-]", "", str(item_data.get("price", "")))
                price_text = price_text.replace(" ", "").replace(",", ".")
                try:
                    price = Decimal(price_text) if price_text else None
                except InvalidOperation:
                    price = None
                db.session.add(MenuItem(
                    category_id=category.id,
                    name=item_name[:200],
                    description=str(item_data.get("description", ""))[:10000],
                    price=price,
                    image_url=str(item_data.get("image", ""))[:500] or None,
                    is_available=True,
                ))
                existing_names.add(item_name.casefold())
                added += 1
        db.session.commit()
        return added

    def save_menu_image(image):
        extension = Path(secure_filename(image.filename)).suffix.lower()
        signatures = {
            ".jpg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
            ".jpeg": ("image/jpeg", lambda data: data.startswith(b"\xff\xd8\xff")),
            ".png": ("image/png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
            ".gif": ("image/gif", lambda data: data.startswith((b"GIF87a", b"GIF89a"))),
            ".webp": ("image/webp", lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP"),
        }
        if extension not in signatures:
            raise ValueError("Formato não suportado. Use JPG, PNG, GIF ou WebP.")
        image.stream.seek(0, os.SEEK_END)
        size = image.stream.tell()
        image.stream.seek(0)
        signature = image.stream.read(12)
        image.stream.seek(0)
        content_type, is_valid = signatures[extension]
        if size == 0 or size > 8 * 1024 * 1024 or not is_valid(signature):
            raise ValueError("O ficheiro não é uma imagem válida ou excede 8 MB.")

        filename = f"{uuid4().hex}{extension}"
        bucket = os.getenv("S3_BUCKET", "").strip()
        if bucket:
            try:
                import boto3
            except ImportError as error:
                raise RuntimeError("O armazenamento de imagens não está disponível.") from error
            client = boto3.client(
                "s3",
                endpoint_url=os.getenv("S3_ENDPOINT_URL") or None,
                region_name=os.getenv("S3_REGION") or None,
                aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID") or None,
                aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY") or None,
            )
            key = f"menu/{filename}"
            client.upload_fileobj(
                image.stream,
                bucket,
                key,
                ExtraArgs={"ContentType": content_type},
            )
            public_base = os.getenv("S3_PUBLIC_BASE_URL", "").rstrip("/")
            if public_base:
                return f"{public_base}/{key}"
            endpoint = os.getenv("S3_ENDPOINT_URL", "").rstrip("/")
            if endpoint:
                return f"{endpoint}/{bucket}/{key}"
            region = os.getenv("S3_REGION", "").strip()
            if not region:
                raise RuntimeError("Configure S3_REGION ou S3_PUBLIC_BASE_URL para servir as imagens.")
            return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"

        if os.getenv("VERCEL"):
            raise RuntimeError("Configure o armazenamento S3 antes de carregar imagens nesta hospedagem.")
        destination = Path(app.config["UPLOAD_FOLDER"]) / "menu"
        destination.mkdir(parents=True, exist_ok=True)
        image.save(destination / filename)
        return f"assets/uploads/menu/{filename}"

    def menu_item_json(item):
        return {
            "id": item.id,
            "name": item.name,
            "description": item.description or "",
            "ingredients": item.ingredients or "",
            "price": float(item.price) if item.price is not None else None,
            "image": item.image_url or "",
            "available": item.is_available,
            "categoryId": item.category_id,
            "category": item.category.name if item.category else "",
        }

    def feedback_json(item):
        return {
            "id": item.id,
            "name": item.customer_name or "Anónimo",
            "email": item.email or "",
            "phone": item.phone or "",
            "type": item.type or "other",
            "space": item.space_name or "",
            "subject": item.subject or "",
            "message": item.message or item.comments or "",
            "answers": item.answers if isinstance(item.answers, dict) else {},
            "status": item.status or "new",
            "internalNotes": item.internal_notes or "",
            "createdAt": item.created_at.isoformat(timespec="minutes"),
        }

    def site_content():
        setting = db.session.scalar(select(SiteSetting).where(SiteSetting.key == "cms_content"))
        if setting and setting.value:
            try:
                return json.loads(setting.value)
            except (TypeError, json.JSONDecodeError):
                app.logger.exception("O conteúdo CMS guardado não contém JSON válido")
        return {
            "brand": {
                "name": "Pátio Luanda",
                "logo": "assets/logo-white.png",
                "title": "Pátio Luanda | Boa comida. Grandes encontros.",
                "heroTitle": "Boa comida. Grandes encontros.",
                "heroSubtitle": "Um lugar para chegar, ficar e deixar Luanda à porta.",
                "phone": "+244 941 180 424",
                "email": "ola@patioluanda.co.ao",
                "hours": "Terça a domingo · 12h — 23h",
                "instagram": "https://www.instagram.com/",
                "facebook": "https://www.facebook.com/",
            },
            "pages": {},
        }

    def serve_site_file(filename):
        response = send_from_directory(ROOT, filename)
        if filename.lower().endswith(".html"):
            response.direct_passthrough = False
            html = response.get_data(as_text=True)
            script = '<script src="/static/cms.js" defer></script>'
            if script not in html:
                html = html.replace("</body>", f"  {script}\n</body>")
                response.set_data(html)
        return response

    @app.get("/")
    def home():
        return serve_site_file("index.html")

    @app.get("/admin")
    def admin():
        user = signed_in()
        if not user or not user.is_active:
            return redirect(url_for("login", next=request.path))
        return render_template("admin.html", csrf_token=csrf_token())

    @app.route("/admin/login", methods=["GET", "POST"])
    def login():
        user = signed_in()
        if user and user.is_active:
            return redirect(url_for("admin"))
        if user:
            session.clear()
        error = None
        if request.method == "POST":
            expected = session.get("csrf_token", "")
            supplied = request.form.get("csrf_token", "")
            if not expected or not hmac.compare_digest(expected, supplied):
                abort(400, description="Token de segurança inválido. Atualize a página e tente novamente.")
            email = request.form.get("email", "").strip().lower()
            password = request.form.get("password", "")
            user = db.session.scalar(select(AdminUser).where(AdminUser.email == email))
            if user and user.is_active and check_password_hash(user.password_hash, password):
                session.clear()
                session["admin_user_id"] = user.id
                csrf_token()
                session.permanent = True
                next_url = request.form.get("next", "")
                if urlparse(next_url).netloc or not next_url.startswith("/"):
                    next_url = url_for("admin")
                return redirect(next_url)
            error = "E-mail ou palavra-passe inválidos."
        return render_template("login.html", csrf_token=csrf_token(), error=error)

    @app.post("/admin/logout")
    def logout():
        require_admin()
        require_csrf()
        session.clear()
        return redirect(url_for("login"))

    @app.post("/api/reservations")
    def create_reservation():
        payload = request.get_json(silent=True)

        if not isinstance(payload, dict):
            return jsonify({"error": "Os dados enviados são inválidos."}), 400

        def text_field(field):
            value = payload.get(field, "")
            return value.strip() if isinstance(value, str) else None

        name = text_field("name")
        phone = text_field("phone")
        email = text_field("email")
        reservation_type = text_field("type")
        space_name = text_field("space")
        event_type = text_field("eventType")
        date_value = text_field("date")
        time_value = text_field("time")
        notes = text_field("message")

        if any(value is None for value in (
            name, phone, email, reservation_type, space_name,
            event_type, date_value, time_value, notes,
        )):
            return jsonify({"error": "Verifique os dados enviados e tente novamente."}), 400

        email = email.lower()

        if not name or len(name) > 150:
            return jsonify({"error": "Indique um nome válido."}), 400
        phone_digits = "".join(character for character in phone if character.isdigit())
        if (
            len(phone) > 40
            or len(phone_digits) < 6
            or any(not (character.isdigit() or character in "+()- .") for character in phone)
        ):
            return jsonify({"error": "Indique um telefone válido."}), 400
        if (
            len(email) > 255
            or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email)
        ):
            return jsonify({"error": "Indique um email válido."}), 400
        if reservation_type not in {"table", "event"}:
            return jsonify({"error": "Escolha um tipo de reserva válido."}), 400
        if space_name not in RESERVATION_SPACES:
            return jsonify({"error": "Escolha um espaço válido."}), 400
        if reservation_type == "event" and not event_type:
            return jsonify({"error": "Indique o tipo de evento."}), 400
        if len(event_type) > 150 or len(notes) > 5000:
            return jsonify({"error": "Algum campo excede o limite permitido."}), 400

        try:
            reservation_at = datetime.strptime(
                f"{date_value} {time_value}", "%Y-%m-%d %H:%M"
            )
            if reservation_at.strftime("%Y-%m-%d %H:%M") != f"{date_value} {time_value}":
                raise ValueError
        except ValueError:
            return jsonify({
                "error": "Indique uma data e um horário válidos."
            }), 400

        guests_value = payload.get("guests")
        if isinstance(guests_value, bool) or not isinstance(guests_value, int):
            return jsonify({"error": "Indique um número inteiro de pessoas."}), 400
        party_size = guests_value
        if not 1 <= party_size <= 200:
            return jsonify({
                "error": "O número de pessoas deve estar entre 1 e 200."
            }), 400
        if reservation_at <= datetime.now():
            return jsonify({"error": "Escolha uma data e hora futuras."}), 400

        reservation = Reservation(
            customer_name=name,
            email=email,
            phone=phone,
            reservation_type=reservation_type,
            space_name=space_name,
            event_type=event_type if reservation_type == "event" else None,
            reservation_at=reservation_at,
            party_size=party_size,
            notes=notes or None,
            status="pending",
        )

        try:
            db.session.add(reservation)
            db.session.commit()
        except Exception:
            db.session.rollback()
            app.logger.exception("Não foi possível guardar o pedido de reserva")
            return jsonify({
                "error": "Não foi possível guardar o pedido. Tente novamente."
            }), 500

        return jsonify({
            "ok": True,
            "message": "O pedido foi guardado com sucesso.",
            "reservationId": reservation.id,
        }), 201


    @app.get("/api/admin/reservations")
    def admin_reservations():
        require_admin()

        try:
            reservations = (
                Reservation.query
                .order_by(Reservation.created_at.desc(), Reservation.id.desc())
                .limit(200)
                .all()
            )
        except Exception:
            db.session.rollback()
            app.logger.exception("Não foi possível carregar as reservas")
            return jsonify({"error": "Não foi possível carregar as reservas."}), 500

        def serialize_reservation(item):
            return {
                "id": item.id,
                "name": item.customer_name,
                "email": item.email or "",
                "phone": item.phone,
                "type": item.reservation_type or "table",
                "space": item.space_name or "",
                "eventType": item.event_type or "",
                "dateTime": item.reservation_at.isoformat(timespec="minutes"),
                "guests": item.party_size,
                "notes": item.notes or "",
                "status": item.status,
                "createdAt": item.created_at.isoformat(timespec="minutes"),
            }

        return jsonify({
            "reservations": [serialize_reservation(item) for item in reservations],
            "csrfToken": csrf_token(),
        })

    @app.patch("/api/admin/reservations/<int:reservation_id>")
    def update_admin_reservation(reservation_id):
        require_admin()
        require_csrf()

        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Pedido inválido."}), 400

        status = payload.get("status")
        allowed_statuses = {"pending", "confirmed", "rejected"}
        if status not in allowed_statuses:
            return jsonify({"error": "Estado de reserva inválido."}), 400

        reservation = db.session.get(Reservation, reservation_id)
        if reservation is None:
            return jsonify({"error": "Reserva não encontrada."}), 404

        reservation.status = status
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            app.logger.exception("Falha ao atualizar reserva")
            return jsonify({"error": "Não foi possível atualizar a reserva."}), 500

        return jsonify({"ok": True, "status": reservation.status})

    @app.get("/api/site-content")
    def public_site_content():
        return jsonify(site_content())

    @app.get("/api/csrf-token")
    def public_csrf_token():
        return jsonify({"csrfToken": csrf_token()})

    @app.get("/api/menu")
    def public_menu():
        categories = MenuCategory.query.filter_by(is_active=True).order_by(
            MenuCategory.sort_order, MenuCategory.id
        ).all()
        result = []
        for category in categories:
            items = MenuItem.query.filter_by(
                category_id=category.id, is_available=True
            ).order_by(MenuItem.sort_order, MenuItem.id).all()
            if items:
                result.append({
                    "id": category.slug,
                    "category": category.name,
                    "items": [{
                        "id": item.id,
                        "name": item.name,
                        "description": item.description or "",
                        "ingredients": item.ingredients or "",
                        "price": float(item.price) if item.price is not None else None,
                        "image": item.image_url or "",
                    } for item in items],
                })
        return jsonify({"categories": result})

    @app.post("/api/feedback")
    def create_feedback():
        expected_csrf = session.get("csrf_token", "")
        supplied_csrf = request.headers.get("X-CSRFToken", "")
        if not expected_csrf or not supplied_csrf or not hmac.compare_digest(expected_csrf, supplied_csrf):
            return jsonify({"error": "Atualize a página e tente novamente."}), 400
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Os dados enviados são inválidos."}), 400

        def field(name, maximum, required=False):
            value = payload.get(name, "")
            if not isinstance(value, str):
                return None
            value = value.strip()
            if len(value) > maximum or (required and not value):
                return None
            return value

        token = field("submissionToken", 64, True)
        name = field("name", 150)
        email = field("email", 255)
        phone = field("phone", 40)
        space = field("space", 150, True)
        subject = field("subject", 200)
        message = field("message", 10000)
        improvements = field("improvements", 5000)
        suggestion = field("suggestion", 5000)
        kind = field("type", 30, True)
        allowed_types = {"complaint", "suggestion", "praise", "other"}
        if any(value is None for value in (token, name, email, phone, space, subject, message, improvements, suggestion, kind)):
            return jsonify({"error": "Verifique os campos e tente novamente."}), 400
        if not re.fullmatch(r"[0-9a-fA-F-]{36}", token):
            return jsonify({"error": "Não foi possível validar o envio. Atualize a página."}), 400
        if kind not in allowed_types:
            return jsonify({"error": "Escolha um tipo de mensagem válido."}), 400
        if space not in FEEDBACK_SPACES:
            return jsonify({"error": "Escolha um espaço ou serviço válido."}), 400
        if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            return jsonify({"error": "Indique um e-mail válido."}), 400
        if phone and (len("".join(character for character in phone if character.isdigit())) < 6
                      or any(not (character.isdigit() or character in "+()- .") for character in phone)):
            return jsonify({"error": "Indique um telefone válido."}), 400
        answers = payload.get("answers", {})
        if not isinstance(answers, dict) or any(
            answers.get(key) not in {"1", "2", "3", "4", "5"}
            for key in ("service_rating", "food_rating", "atmosphere_rating")
        ):
            return jsonify({"error": "Preencha as três avaliações da visita."}), 400
        existing = db.session.scalar(
            select(FeedbackSubmission).where(FeedbackSubmission.submission_token == token)
        )
        if existing:
            return jsonify({"ok": True, "message": "A mensagem já foi recebida."}), 200

        full_message = message or "\n\n".join(
            part for part in (
                f"O que gostaria de ver melhorado?\n{improvements}" if improvements else "",
                f"Sugestão adicional\n{suggestion}" if suggestion else "",
            ) if part
        )
        submission = FeedbackSubmission(
            customer_name=name or None,
            contact=email or phone or None,
            email=email or None,
            phone=phone or None,
            space_name=space,
            type=kind,
            subject=subject or None,
            message=full_message,
            answers=answers,
            comments="\n\n".join(part for part in (improvements, suggestion) if part) or None,
            status="new",
            submission_token=token.lower(),
        )
        try:
            db.session.add(submission)
            db.session.commit()
        except Exception:
            db.session.rollback()
            existing = db.session.scalar(
                select(FeedbackSubmission).where(FeedbackSubmission.submission_token == token.lower())
            )
            if existing:
                return jsonify({"ok": True, "message": "A mensagem já foi recebida."}), 200
            app.logger.warning("Não foi possível guardar uma mensagem de contacto")
            return jsonify({"error": "Não foi possível enviar a mensagem. Tente novamente."}), 500
        return jsonify({"ok": True, "message": "A sua mensagem foi enviada com sucesso."}), 201

    @app.get("/api/admin/menu")
    def admin_menu():
        require_admin()
        imported_items = import_menu_json()
        categories = MenuCategory.query.order_by(MenuCategory.sort_order, MenuCategory.id).all()
        items = MenuItem.query.order_by(MenuItem.sort_order, MenuItem.id).all()
        return jsonify({
            "categories": [{"id": item.id, "name": item.name, "slug": item.slug} for item in categories],
            "items": [menu_item_json(item) for item in items],
            "importedItems": imported_items,
            "csrfToken": csrf_token(),
        })

    def save_menu_item(item=None):
        require_admin()
        require_csrf()
        payload = request.form
        name = payload.get("name", "").strip()
        description = payload.get("description", "").strip()
        ingredients = payload.get("ingredients", "").strip()
        category_name = payload.get("new_category", "").strip() or payload.get("category", "").strip()
        price_text = payload.get("price", "").strip()
        image = request.files.get("image")
        if not name or len(name) > 200 or len(description) > 10000 or len(ingredients) > 5000:
            return jsonify({"error": "Preencha um nome válido e respeite os limites dos campos."}), 400
        if not category_name or len(category_name) > 150:
            return jsonify({"error": "Escolha ou indique uma categoria válida."}), 400
        try:
            price = Decimal(price_text)
            if not price.is_finite() or price <= 0 or price > Decimal("9999999999.99"):
                raise InvalidOperation
        except (InvalidOperation, ValueError):
            return jsonify({"error": "Indique um preço válido e superior a zero."}), 400
        category_slug = safe_slug(category_name)
        if not category_slug:
            return jsonify({"error": "Indique uma categoria válida."}), 400
        category = db.session.scalar(select(MenuCategory).where(MenuCategory.slug == category_slug))
        if category is None:
            category = MenuCategory(name=category_name, slug=category_slug, is_active=True)
            db.session.add(category)
            db.session.flush()
        available = payload.get("available") == "true"
        image_url = item.image_url if item else None
        if image and image.filename:
            try:
                image_url = save_menu_image(image)
            except ValueError as error:
                return jsonify({"error": str(error)}), 400
            except RuntimeError as error:
                return jsonify({"error": str(error)}), 503
            except Exception:
                app.logger.exception("Não foi possível armazenar a fotografia do prato")
                return jsonify({"error": "Não foi possível armazenar a fotografia."}), 503
        elif not image_url:
            return jsonify({"error": "Escolha uma fotografia para o prato."}), 400
        if item is None:
            item = MenuItem()
            db.session.add(item)
        item.name = name
        item.description = description
        item.ingredients = ingredients
        item.price = price
        item.category_id = category.id
        item.image_url = image_url
        item.is_available = available
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            app.logger.exception("Não foi possível guardar um prato do menu")
            return jsonify({"error": "Não foi possível guardar o prato."}), 500
        return jsonify({"ok": True, "item": menu_item_json(item)}), 201 if item.id and request.method == "POST" else 200

    @app.post("/api/admin/menu")
    def create_menu_item():
        return save_menu_item()

    @app.put("/api/admin/menu/<int:item_id>")
    def update_menu_item(item_id):
        require_admin()
        item = db.session.get(MenuItem, item_id)
        if item is None:
            return jsonify({"error": "Prato não encontrado."}), 404
        return save_menu_item(item)

    @app.delete("/api/admin/menu/<int:item_id>")
    def delete_menu_item(item_id):
        require_admin()
        require_csrf()
        item = db.session.get(MenuItem, item_id)
        if item is None:
            return jsonify({"error": "Prato não encontrado."}), 404
        db.session.delete(item)
        db.session.commit()
        return jsonify({"ok": True})

    @app.patch("/api/admin/menu/<int:item_id>/availability")
    def update_menu_availability(item_id):
        require_admin()
        require_csrf()
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("available"), bool):
            return jsonify({"error": "Indique uma disponibilidade válida."}), 400
        item = db.session.get(MenuItem, item_id)
        if item is None:
            return jsonify({"error": "Prato não encontrado."}), 404
        item.is_available = payload["available"]
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            app.logger.exception("Não foi possível atualizar a disponibilidade do prato")
            return jsonify({"error": "Não foi possível atualizar a disponibilidade."}), 500
        return jsonify({"ok": True, "available": item.is_available})

    @app.get("/api/admin/feedback")
    def admin_feedback():
        require_admin()
        query = FeedbackSubmission.query
        kind = request.args.get("type", "").strip()
        status = request.args.get("status", "").strip()
        space = request.args.get("space", "").strip()
        date_from = request.args.get("date_from", "").strip()
        date_to = request.args.get("date_to", "").strip()
        search = request.args.get("q", "").strip()[:200]
        if kind in {"complaint", "suggestion", "praise", "other"}:
            query = query.filter(FeedbackSubmission.type == kind)
        if status in {"new", "reviewing", "resolved"}:
            query = query.filter(FeedbackSubmission.status == status)
        if space:
            query = query.filter(FeedbackSubmission.space_name == space)
        try:
            if date_from:
                query = query.filter(FeedbackSubmission.created_at >= datetime.strptime(date_from, "%Y-%m-%d"))
            if date_to:
                query = query.filter(FeedbackSubmission.created_at < datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1))
        except ValueError:
            return jsonify({"error": "Indique um intervalo de datas válido."}), 400
        if search:
            pattern = f"%{search}%"
            query = query.filter(
                or_(
                    FeedbackSubmission.customer_name.ilike(pattern),
                    FeedbackSubmission.subject.ilike(pattern),
                    FeedbackSubmission.message.ilike(pattern),
                    FeedbackSubmission.comments.ilike(pattern),
                )
            )
        items = query.order_by(FeedbackSubmission.created_at.desc(), FeedbackSubmission.id.desc()).all()
        new_count = FeedbackSubmission.query.filter_by(status="new").count()
        complaint_count = FeedbackSubmission.query.filter_by(type="complaint").filter(
            FeedbackSubmission.status != "resolved"
        ).count()
        spaces = [value[0] for value in db.session.query(FeedbackSubmission.space_name).filter(
            FeedbackSubmission.space_name.isnot(None)
        ).distinct().order_by(FeedbackSubmission.space_name).all()]
        return jsonify({
            "submissions": [feedback_json(item) for item in items],
            "counts": {"new": new_count, "pendingComplaints": complaint_count},
            "spaces": spaces,
            "csrfToken": csrf_token(),
        })

    @app.patch("/api/admin/feedback/<int:submission_id>")
    def update_admin_feedback(submission_id):
        require_admin()
        require_csrf()
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Pedido inválido."}), 400
        submission = db.session.get(FeedbackSubmission, submission_id)
        if submission is None:
            return jsonify({"error": "Mensagem não encontrada."}), 404
        status = payload.get("status")
        notes = payload.get("internalNotes")
        if status not in {"new", "reviewing", "resolved"}:
            return jsonify({"error": "Estado da mensagem inválido."}), 400
        if not isinstance(notes, str) or len(notes) > 10000:
            return jsonify({"error": "As notas internas excedem o limite permitido."}), 400
        submission.status = status
        submission.internal_notes = notes.strip() or None
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            app.logger.exception("Não foi possível atualizar uma mensagem de contacto")
            return jsonify({"error": "Não foi possível atualizar a mensagem."}), 500
        return jsonify({"ok": True, "status": submission.status})

    @app.get("/api/admin/site-content")
    def admin_site_content():
        require_admin()
        return jsonify({"content": site_content(), "csrfToken": csrf_token()})

    @app.put("/api/admin/site-content")
    def save_site_content():
        require_admin()
        require_csrf()
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(payload.get("brand"), dict) or not isinstance(payload.get("pages"), dict):
            return jsonify({"error": "O conteúdo enviado não tem o formato esperado."}), 400
        if len(request.data) > 2 * 1024 * 1024:
            return jsonify({"error": "O conteúdo excede o limite permitido."}), 413
        setting = db.session.scalar(select(SiteSetting).where(SiteSetting.key == "cms_content"))
        if setting is None:
            setting = SiteSetting(key="cms_content")
            db.session.add(setting)
        setting.value = json.dumps(payload, ensure_ascii=False)
        db.session.commit()
        return jsonify({"ok": True})

    @app.post("/api/admin/upload")
    def upload_image():
        require_admin()
        require_csrf()
        image = request.files.get("image")
        if not image or not image.filename:
            return jsonify({"error": "Escolha uma imagem para enviar."}), 400
        extension = Path(secure_filename(image.filename)).suffix.lower()
        signatures = {
            ".jpg": lambda data: data.startswith(b"\xff\xd8\xff"),
            ".jpeg": lambda data: data.startswith(b"\xff\xd8\xff"),
            ".png": lambda data: data.startswith(b"\x89PNG\r\n\x1a\n"),
            ".gif": lambda data: data.startswith((b"GIF87a", b"GIF89a")),
            ".webp": lambda data: data.startswith(b"RIFF") and data[8:12] == b"WEBP",
        }
        if extension not in signatures:
            return jsonify({"error": "Formato não suportado. Use JPG, PNG, GIF ou WebP."}), 400
        image.stream.seek(0, os.SEEK_END)
        size = image.stream.tell()
        image.stream.seek(0)
        signature = image.stream.read(12)
        image.stream.seek(0)
        if size > 8 * 1024 * 1024 or size == 0 or not signatures[extension](signature):
            return jsonify({"error": "O ficheiro não é uma imagem válida ou excede 8 MB."}), 400
        filename = f"{uuid4().hex}{extension}"
        destination = Path(app.config["UPLOAD_FOLDER"])
        destination.mkdir(parents=True, exist_ok=True)
        image.save(destination / filename)
        return jsonify({"url": f"assets/uploads/{filename}"})

    @app.get("/<path:filename>")
    def public_file(filename):
        requested = Path(filename)
        allowed_directories = {"assets", "css", "data", "js", "patio aeroporto"}
        if requested.is_absolute() or any(part.startswith(".") for part in requested.parts):
            abort(404)
        if len(requested.parts) == 1:
            if requested.suffix.lower() != ".html":
                abort(404)
        elif requested.parts[0] not in allowed_directories:
            abort(404)
        return serve_site_file(filename)

    @app.errorhandler(413)
    def request_too_large(_error):
        return jsonify({"error": "O ficheiro excede o limite de 8 MB."}), 413

    @app.cli.command("init-db")
    def init_db_command():
        migrate_feature_schema()
        added = import_menu_json()
        click.echo(f"Schema atualizado; {added} prato(s) importado(s) do menu existente.")

    @app.cli.command("migrate-features")
    def migrate_features_command():
        migrate_feature_schema()
        added = import_menu_json()
        click.echo(f"Migração concluída; {added} prato(s) novo(s) importado(s).")

    @app.cli.command("create-admin")
    @click.option("--email", prompt=True)
    @click.option("--name", prompt="Nome", default="Administrador")
    def create_admin_command(email, name):
        email = email.strip().lower()
        if db.session.scalar(select(AdminUser).where(AdminUser.email == email)):
            raise click.ClickException("Já existe um utilizador com esse e-mail.")
        password = click.prompt("Palavra-passe (mínimo 12 caracteres)", hide_input=True, confirmation_prompt=True)
        if len(password) < 12:
            raise click.ClickException("A palavra-passe deve ter pelo menos 12 caracteres.")
        password_hash = generate_password_hash(password, method="pbkdf2:sha256")
        db.session.add(AdminUser(name=name.strip(), email=email, password_hash=password_hash))
        db.session.commit()
        click.echo(f"Conta administrativa criada para {email}.")


    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=5000)
