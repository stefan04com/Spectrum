from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError

from database import db_session
from models import User

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


def error_response(message, status=400):
    return jsonify({"error": message}), status


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json or {}
    required_fields = ["email", "password", "role"]
    missing = [field for field in required_fields if not data.get(field)]
    if missing:
        return error_response(f"Missing fields: {', '.join(missing)}")

    with db_session() as session:
        user = User(email=data["email"].strip(), password=data["password"], role=data["role"].strip())
        session.add(user)
        try:
            session.flush()
        except IntegrityError:
            return error_response("Email already registered", status=409)

        return jsonify({"message": "User created", "user_id": user.id})


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return error_response("Email and password are required")

    with db_session() as session:
        user = session.query(User).filter(User.email == email.strip()).first()
        if user and user.password == password:
            return jsonify({
                "user_id": user.id,
                "role": user.role
            })

    return error_response("Invalid credentials", status=401)
