
import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api"
).replace(/\/+$/, "");

const emptyForm = {
  name: "",
  age: "",
  gender: "",
  ward: "",
  department: "",
  doctor: "",
  admission_date: "",
  status: "Admitted",
};

function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function App() {
  const [activeView, setActiveView] = useState("dashboard");
  const [patients, setPatients] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [options, setOptions] = useState({
    genders: [],
    wards: [],
    departments: [],
    doctors: [],
  });

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [ward, setWard] = useState("");
  const [department, setDepartment] = useState("");
  const [doctor, setDoctor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const requestSequence = useRef(0);

  async function loadOptions() {
    try {
      const response = await fetch(`${API}/options`);
      if (!response.ok) throw new Error("Could not load dropdown options.");
      const data = await response.json();
      setOptions(data);
    } catch (err) {
      setError(err.message);
    }
  }


async function loadPatients() {
  const sequence = ++requestSequence.current;
  setLoading(true);

  try {
    // Fetch ALL patients for dashboard statistics
    const allResponse = await fetch(`${API}/patients`);

    if (!allResponse.ok) {
      throw new Error("Could not load all patient records.");
    }

    const allData = await allResponse.json();
    if (sequence !== requestSequence.current) return;
    setAllPatients(allData);

    // Fetch filtered patients for the table
    const params = new URLSearchParams();

    if (search.trim()) params.set("search", search.trim());
    if (ward) params.set("ward", ward);
    if (department) params.set("department", department);
    if (doctor) params.set("doctor", doctor);

    const response = await fetch(
      `${API}/patients?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error("Could not load patient records.");
    }

    const data = await response.json();
    if (sequence !== requestSequence.current) return;
    setPatients(data);

  } catch (err) {
    if (sequence === requestSequence.current) {
      setError(err instanceof TypeError
        ? "Cannot connect to the patient service. Check that the backend is running and try again."
        : err.message);
    }
  } finally {
    if (sequence === requestSequence.current) setLoading(false);
  }
}

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPatients();
    }, 250);

    return () => clearTimeout(timer);
  }, [search, ward, department, doctor]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function validateForm() {
    if (!form.name.trim()) return "Patient name is required.";

    if (!/^[A-Za-z ]+$/.test(form.name.trim())) {
      return "Name must contain letters only.";
    }

    if (form.age === "") return "Age is required.";

    const age = Number(form.age);

    if (!Number.isInteger(age) || age < 0 || age > 120) {
      return "Age must be a whole number between 0 and 120.";
    }

    if (!options.genders.includes(form.gender)) {
      return "Please select a valid gender.";
    }

    if (!options.wards.includes(form.ward)) {
      return "Please select a valid ward.";
    }

    if (!options.departments.includes(form.department)) {
      return "Please select a valid department.";
    }

    if (!options.doctors.includes(form.doctor)) {
      return "Please select a valid doctor.";
    }

    if (!form.admission_date) {
      return "Admission date is required.";
    }

    if (form.admission_date > getToday()) {
      return "Admission date cannot be in the future.";
    }

    return "";
  }

  function openAddForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(patient) {
    setEditingId(patient.id);
    setForm({
      name: patient.name,
      age: String(patient.age),
      gender: patient.gender,
      ward: patient.ward,
      department: patient.department,
      doctor: patient.doctor,
      admission_date: patient.admission_date,
      status: patient.status,
    });
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      ...form,
      name: form.name.trim(),
      age: Number(form.age),
    };

    const url = editingId
      ? `${API}/patients/${editingId}`
      : `${API}/patients`;

    try {
      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        const details = data.details
          ? Object.values(data.details).join(" ")
          : "";

        throw new Error(details || data.error || "Unable to save patient.");
      }

      setShowForm(false);
      setForm(emptyForm);
      setEditingId(null);
      setSuccess(data.message || "Patient saved successfully.");

      await loadPatients();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDischarge(patient) {
    if (patient.status === "Discharged") return;

    const confirmed = window.confirm(
      `Are you sure you want to discharge ${patient.name}?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API}/patients/${patient.id}/discharge`,
        { method: "PATCH" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not discharge patient.");
      }

      setSuccess(data.message);
      setError("");
      await loadPatients();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(patient) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${patient.name}?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API}/patients/${patient.id}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not delete patient.");
      }

      setSuccess(data.message);
      setError("");
      await loadPatients();
    } catch (err) {
      setError(err.message);
    }
  }

  function clearFilters() {
    setSearch("");
    setWard("");
    setDepartment("");
    setDoctor("");
  }

 const admittedCount = allPatients.filter(
  (patient) => patient.status === "Admitted"
).length;

const dischargedCount = allPatients.filter(
  (patient) => patient.status === "Discharged"
).length;

  const activeFilters = search || ward || department || doctor;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">✚</div>
          <div>
            <h2>DScribe</h2>
            <span>Patient Management</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <button type="button" className={`nav-item ${activeView === "dashboard" ? "active" : ""}`} aria-current={activeView === "dashboard" ? "page" : undefined} onClick={() => { setActiveView("dashboard"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <span>▦</span> Dashboard
        </button>

        <button type="button" className={`nav-item ${activeView === "patients" ? "active" : ""}`} aria-current={activeView === "patients" ? "page" : undefined} onClick={() => { setActiveView("patients"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
          <span>♙</span> Patients
        </button>

        <div className="sidebar-footer">
          <div className="profile-avatar">HS</div>
          <div>
            <strong>Hospital Staff</strong>
            <span>Administrator</span>
          </div>
        </div>
      </aside>

<main className="main">
  <header className="topbar">
    <div>
      <span className="breadcrumb">Workspace / {activeView === "dashboard" ? "Dashboard" : "Patients"}</span>
      <h1>{activeView === "dashboard" ? "Patient Dashboard" : "Patients"}</h1>
      <p>{activeView === "dashboard" ? "Manage hospital admissions and patient records." : "Search, filter, and manage patient admission records."}</p>

      <span className="dashboard-date">
        {new Date().toLocaleDateString("en-IN", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </span>
    </div>

    <button className="primary-button" onClick={openAddForm}>
      <span>＋</span> Add Patient
    </button>
  </header>


        {error && (
          <div className="alert error-alert">
            {error}
            <button onClick={() => setError("")}>×</button>
          </div>
        )}

        {success && (
          <div className="alert success-alert">
            {success}
            <button onClick={() => setSuccess("")}>×</button>
          </div>
        )}

        {activeView === "dashboard" && <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue">♙</div>
            <span>Total Patients</span>
            <h2>{allPatients.length}</h2>
            <small>Total registered patients</small>
          </div>

          <div className="stat-card">
            <div className="stat-icon green">✚</div>
            <span>Admitted</span>
            <h2>{admittedCount}</h2>
            <small>Currently admitted</small>
          </div>

          <div className="stat-card">
            <div className="stat-icon purple">✓</div>
            <span>Discharged</span>
            <h2>{dischargedCount}</h2>
            <small>Discharged patients</small>
          </div>
        </section>}

        {activeView === "dashboard" && (
          <div className="dashboard-actions">
            <button
              className="primary-button"
              onClick={() => setActiveView("patients")}
            >
              View patient records
            </button>
          </div>
        )}

        {activeView === "patients" && <section className="patients-section" id="patient-records">
          <div className="section-heading">
            <div>
              <h2>Patient Records</h2>
              <p>View and manage patient admission details.</p>
            </div>

            <button className="outline-button" onClick={loadPatients}>
              ↻ Refresh
            </button>
          </div>

          <div className="filters">
            <input
              className="search-input"
              type="search"
              placeholder="⌕  Search patient name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select value={ward} onChange={(e) => setWard(e.target.value)}>
              <option value="">All Wards</option>
              {options.wards.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All Departments</option>
              {options.departments.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            <select
              value={doctor}
              onChange={(e) => setDoctor(e.target.value)}
            >
              <option value="">All Doctors</option>
              {options.doctors.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>

            {activeFilters && (
              <button className="clear-button" onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>PATIENT</th>
                  <th>AGE / GENDER</th>
                  <th>WARD</th>
                  <th>DEPARTMENT</th>
                  <th>DOCTOR</th>
                  <th>ADMISSION DATE</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      Loading patient records...
                    </td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty-state">
                      <div className="empty-icon">♙</div>
                      <strong>No patients found</strong>
                      <p>Add a patient or change your filters.</p>
                    </td>
                  </tr>
                ) : (
                  patients.map((patient) => (
                    <tr key={patient.id}>
                      <td>
                        <div className="patient-name">
                          <div className="patient-avatar">
                            {patient.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong>{patient.name}</strong>
                            <span>Patient #{patient.id}</span>
                          </div>
                        </div>
                      </td>

                      <td>{patient.age} / {patient.gender}</td>
                      <td>{patient.ward}</td>
                      <td>{patient.department}</td>
                      <td>{patient.doctor}</td>
                      <td>{patient.admission_date}</td>

                      <td>
                        <span
                          className={`status-badge ${
                            patient.status === "Admitted"
                              ? "admitted"
                              : "discharged"
                          }`}
                        >
                          {patient.status}
                        </span>
                      </td>

                      <td>
                        <div className="actions">
                          <button
                            className="action-button edit"
                            title="Edit patient"
                            onClick={() => openEditForm(patient)}
                          >
                            ✎
                          </button>

                          {patient.status === "Admitted" && (
                            <button
                              className="action-button discharge"
                              title="Discharge patient"
                              onClick={() => handleDischarge(patient)}
                            >
                              ✓
                            </button>
                          )}

                          <button
                            className="action-button delete"
                            title="Delete patient"
                            onClick={() => handleDelete(patient)}
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="table-footer">
            Showing {patients.length} patient record(s)
          </div>
        </section>}

        <footer className="footer">
          CareFlow Patient Management System
          <span>Powered by React + Flask + SQLite</span>
        </footer>
      </main>

      {showForm && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowForm(false);
              setError("");
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>{editingId ? "Edit Patient" : "Add New Patient"}</h2>
                <p>Enter the patient admission information below.</p>
              </div>

              <button
                className="close-button"
                onClick={() => {
                  setShowForm(false);
                  setError("");
                }}
                disabled={saving}
              >
                ×
              </button>
            </div>
            {error && (
              <div className="alert alert-error" role="alert">
                  {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <label className="full-width">
                  Patient Name *
                  <input
                    name="name"
                    value={form.name}
                    onChange={updateField}
                    placeholder="Enter patient name"
                    required
                  />
                </label>

                <label>
                  Age *
                  <input
                    name="age"
                    type="number"
                    min="0"
                    max="120"
                    step="1"
                    value={form.age}
                    onChange={updateField}
                    placeholder="Enter age"
                    required
                  />
                </label>

                <label>
                  Gender *
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={updateField}
                    required
                  >
                    <option value="">Select gender</option>
                    {options.genders.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Ward *
                  <select
                    name="ward"
                    value={form.ward}
                    onChange={updateField}
                    required
                  >
                    <option value="">Select ward</option>
                    {options.wards.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Department *
                  <select
                    name="department"
                    value={form.department}
                    onChange={updateField}
                    required
                  >
                    <option value="">Select department</option>
                    {options.departments.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label className="full-width">
                  Doctor *
                  <select
                    name="doctor"
                    value={form.doctor}
                    onChange={updateField}
                    required
                  >
                    <option value="">Select doctor</option>
                    {options.doctors.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Admission Date *
                  <input
                    name="admission_date"
                    type="date"
                    max={getToday()}
                    value={form.admission_date}
                    onChange={updateField}
                    required
                  />
                </label>

                <label>
                  Status *
                  <select
                    name="status"
                    value={form.status}
                    onChange={updateField}
                    required
                  >
                    <option value="Admitted">Admitted</option>
                    <option value="Discharged">Discharged</option>
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="outline-button"
                  onClick={() => {
                    setShowForm(false);
                    setError("");
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update Patient"
                    : "Save Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
