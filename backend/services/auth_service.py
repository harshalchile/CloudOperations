import re
from flask_bcrypt import Bcrypt
from flask_jwt_extended import create_access_token
from models.user import db, User

bcrypt = Bcrypt()

def register_user_service(name, email, password):
    if not name or not email or not password:
        return {'error': 'Full Name, Email and Password are required.'}, 400

    email_clean = email.strip().lower()
    email_regex = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'
    if not re.match(email_regex, email_clean):
        return {'error': 'Invalid email address format.'}, 400

    if len(password) < 6:
        return {'error': 'Password must be at least 6 characters long.'}, 400

    existing_user = User.query.filter_by(email=email_clean).first()
    if existing_user:
        return {'error': 'Email address is already registered.'}, 409

    password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
    new_user = User(
        name=name.strip(),
        email=email_clean,
        password_hash=password_hash
    )

    db.session.add(new_user)
    db.session.commit()

    access_token = create_access_token(identity=str(new_user.id))
    return {
        'message': 'Registration successful.',
        'user': new_user.to_dict(),
        'access_token': access_token
    }, 201

def login_user_service(email, password):
    if not email or not password:
        return {'error': 'Email and password are required.'}, 400

    user = User.query.filter_by(email=email.strip().lower()).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return {'error': 'Invalid email or password.'}, 401

    access_token = create_access_token(identity=str(user.id))
    return {
        'message': 'Login successful.',
        'user': user.to_dict(),
        'access_token': access_token
    }, 200

def update_profile_service(user, name, email):
    if not name or not email:
        return {'error': 'Name and Email cannot be empty.'}, 400

    email_clean = email.strip().lower()
    if email_clean != user.email:
        existing = User.query.filter_by(email=email_clean).first()
        if existing:
            return {'error': 'Email is already in use by another user.'}, 409
        user.email = email_clean

    user.name = name.strip()
    db.session.commit()

    return {
        'message': 'Profile updated successfully.',
        'user': user.to_dict()
    }, 200

def change_password_service(user, current_password, new_password):
    if not current_password or not new_password:
        return {'error': 'Current and new password are required.'}, 400

    if not bcrypt.check_password_hash(user.password_hash, current_password):
        return {'error': 'Current password is incorrect.'}, 400

    if len(new_password) < 6:
        return {'error': 'New password must be at least 6 characters long.'}, 400

    user.password_hash = bcrypt.generate_password_hash(new_password).decode('utf-8')
    db.session.commit()

    return {'message': 'Password updated successfully.'}, 200
