
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import date
import os
import re

from database import get_db_connection, init_db

app = Flask(__name__)

# Allow the React frontend to communicate with Flask
allowed_origins = os.environ.get(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174"
)
CORS(app, origins=[
    origin.strip() for origin in allowed_origins.split(",") if origin.strip()
])

# Initialize the database whenever the backend starts
init_db()

# Dropdown options used by the frontend and backend
OPTIONS = {
    "genders": ["Male", "Female", "Other"],
    "wards": ["General Ward", "ICU", "Private Ward", "Emergency Ward"],
    "departments": [
        "Cardiology",
        "Neurology",
        "Orthopedics",
        "Pediatrics",
        "General Medicine",
        "Surgery"
    ],
    "doctors": [
        "Dr. Sharma",
        "Dr. Patel",
        "Dr. Kumar",
        "Dr. Reddy",
        "Dr. Singh"
    ]
}


# ---------------------------------
# VALIDATION
# ---------------------------------

def validate_patient(data):
    errors = {}

    if not isinstance(data, dict):
        return {"general": "Request body must be a JSON object."}

    # Name validation
    name = data.get("name")

    if not isinstance(name, str) or not name.strip():
        errors["name"] = "Name is required."
    elif not re.fullmatch(r"[A-Za-z ]+", name.strip()):
        errors["name"] = "Name must contain letters only."

    # Age validation
    age = data.get("age")

    if age is None or age == "":
        errors["age"] = "Age is required."
    elif isinstance(age, bool) or not isinstance(age, int):
        errors["age"] = "Age must be a whole number."
    elif age < 0 or age > 120:
        errors["age"] = "Age must be between 0 and 120."

    # Dropdown validation
    for field, option_key in [
        ("gender", "genders"),
        ("ward", "wards"),
        ("department", "departments"),
        ("doctor", "doctors")
    ]:
        value = data.get(field)

        if not isinstance(value, str) or not value.strip():
            errors[field] = f"{field.capitalize()} is required."
        elif value not in OPTIONS[option_key]:
            errors[field] = f"Invalid {field}. Please select a valid option."

    # Admission date validation
    admission_date = data.get("admission_date")

    if not isinstance(admission_date, str) or not admission_date.strip():
        errors["admission_date"] = "Admission date is required."
    else:
        try:
            parsed_date = date.fromisoformat(admission_date)

            if parsed_date > date.today():
                errors["admission_date"] = "Admission date cannot be in the future."

        except ValueError:
            errors["admission_date"] = "Enter a valid date in YYYY-MM-DD format."

    # Status validation
    status = data.get("status", "Admitted")

    if status not in ["Admitted", "Discharged"]:
        errors["status"] = "Status must be Admitted or Discharged."

    return errors


# ---------------------------------
# HOME AND OPTIONS API
# ---------------------------------

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Patient Admission Management API is running!"
    })


@app.route("/api/options", methods=["GET"])
def get_options():
    return jsonify(OPTIONS)


# ---------------------------------
# GET ALL PATIENTS + SEARCH + FILTER
# ---------------------------------

@app.route("/api/patients", methods=["GET"])
def get_patients():

    search = request.args.get("search", "").strip()
    ward = request.args.get("ward", "").strip()
    department = request.args.get("department", "").strip()
    doctor = request.args.get("doctor", "").strip()

    query = "SELECT * FROM patients WHERE 1=1"
    values = []

    if search:
        query += " AND name LIKE ?"
        values.append(f"%{search}%")

    if ward:
        query += " AND ward = ?"
        values.append(ward)

    if department:
        query += " AND department = ?"
        values.append(department)

    if doctor:
        query += " AND doctor = ?"
        values.append(doctor)

    query += " ORDER BY id DESC"

    connection = get_db_connection()

    try:
        patients = connection.execute(query, values).fetchall()

        return jsonify([
            dict(patient) for patient in patients
        ]), 200

    finally:
        connection.close()


# ---------------------------------
# ADD PATIENT
# ---------------------------------

@app.route("/api/patients", methods=["POST"])
def add_patient():

    data = request.get_json(silent=True)

    if data is None:
        return jsonify({
            "error": "A valid JSON request body is required."
        }), 400

    errors = validate_patient(data)

    if errors:
        return jsonify({
            "error": "Validation failed.",
            "details": errors
        }), 400

    connection = get_db_connection()

    try:
        cursor = connection.execute("""
            INSERT INTO patients
            (name, age, gender, ward, department, doctor,
             admission_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data["name"].strip(),
            data["age"],
            data["gender"],
            data["ward"],
            data["department"],
            data["doctor"],
            data["admission_date"],
            data.get("status", "Admitted")
        ))

        connection.commit()

        patient = connection.execute(
            "SELECT * FROM patients WHERE id = ?",
            (cursor.lastrowid,)
        ).fetchone()

        return jsonify({
            "message": "Patient added successfully.",
            "patient": dict(patient)
        }), 201

    finally:
        connection.close()


# ---------------------------------
# EDIT PATIENT
# ---------------------------------

@app.route("/api/patients/<int:patient_id>", methods=["PUT"])
def update_patient(patient_id):

    data = request.get_json(silent=True)

    if data is None:
        return jsonify({
            "error": "A valid JSON request body is required."
        }), 400

    errors = validate_patient(data)

    if errors:
        return jsonify({
            "error": "Validation failed.",
            "details": errors
        }), 400

    connection = get_db_connection()

    try:
        existing = connection.execute(
            "SELECT id FROM patients WHERE id = ?",
            (patient_id,)
        ).fetchone()

        if existing is None:
            return jsonify({
                "error": "Patient not found."
            }), 404

        connection.execute("""
            UPDATE patients
            SET name = ?,
                age = ?,
                gender = ?,
                ward = ?,
                department = ?,
                doctor = ?,
                admission_date = ?,
                status = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (
            data["name"].strip(),
            data["age"],
            data["gender"],
            data["ward"],
            data["department"],
            data["doctor"],
            data["admission_date"],
            data.get("status", "Admitted"),
            patient_id
        ))

        connection.commit()

        patient = connection.execute(
            "SELECT * FROM patients WHERE id = ?",
            (patient_id,)
        ).fetchone()

        return jsonify({
            "message": "Patient updated successfully.",
            "patient": dict(patient)
        }), 200

    finally:
        connection.close()


# ---------------------------------
# DISCHARGE PATIENT
# ---------------------------------

@app.route("/api/patients/<int:patient_id>/discharge", methods=["PATCH"])
def discharge_patient(patient_id):

    connection = get_db_connection()

    try:
        patient = connection.execute(
            "SELECT * FROM patients WHERE id = ?",
            (patient_id,)
        ).fetchone()

        if patient is None:
            return jsonify({
                "error": "Patient not found."
            }), 404

        if patient["status"] == "Discharged":
            return jsonify({
                "message": "Patient is already discharged."
            }), 200

        connection.execute("""
            UPDATE patients
            SET status = 'Discharged',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (patient_id,))

        connection.commit()

        return jsonify({
            "message": "Patient discharged successfully."
        }), 200

    finally:
        connection.close()


# ---------------------------------
# DELETE PATIENT
# ---------------------------------

@app.route("/api/patients/<int:patient_id>", methods=["DELETE"])
def delete_patient(patient_id):

    connection = get_db_connection()

    try:
        patient = connection.execute(
            "SELECT id FROM patients WHERE id = ?",
            (patient_id,)
        ).fetchone()

        if patient is None:
            return jsonify({
                "error": "Patient not found."
            }), 404

        connection.execute(
            "DELETE FROM patients WHERE id = ?",
            (patient_id,)
        )

        connection.commit()

        return jsonify({
            "message": "Patient deleted successfully."
        }), 200

    finally:
        connection.close()


# ---------------------------------
# START FLASK SERVER
# ---------------------------------

if __name__ == "__main__":
    app.run(debug=True, port=int(os.environ.get("PORT", 5000)))
